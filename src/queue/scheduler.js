import { db, now } from '../db.js';
import { runJob, CRON_EXPR, nextRunFromCron } from './runJob.js';

let bullQueue = null;
let bullWorker = null;
let usingBull = false;
const inMemoryTimers = new Map(); // jobId -> Timeout

async function setupBull() {
  if (!process.env.REDIS_URL) return false;
  try {
    const { Queue, Worker } = await import('bullmq');
    const IORedis = (await import('ioredis')).default;
    const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
    bullQueue = new Queue('scrape-yard', { connection });
    bullWorker = new Worker('scrape-yard', async (job) => {
      const { jobId } = job.data;
      return await runJob(jobId);
    }, { connection, concurrency: 4 });

    bullWorker.on('failed', (job, err) => {
      console.error(`[bull] job ${job?.id} failed:`, err.message);
    });
    bullWorker.on('completed', (job, result) => {
      console.log(`[bull] job ${job.data.jobId} done`, result?.inserted ?? '');
    });
    usingBull = true;
    console.log('[scheduler] using BullMQ + Redis');
    return true;
  } catch (e) {
    console.warn('[scheduler] BullMQ unavailable, using in-memory:', e.message);
    return false;
  }
}

export async function initScheduler() {
  await setupBull();
  // (Re-)schedule everything currently in DB.
  const jobs = db.prepare(`SELECT id, cron, status FROM jobs`).all();
  for (const j of jobs) {
    if (j.status === 'paused') continue;
    await scheduleJob(j.id, j.cron);
  }
}

export async function scheduleJob(jobId, cronPreset) {
  await unscheduleJob(jobId);
  if (cronPreset === 'manual') {
    db.prepare('UPDATE jobs SET next_run_at = NULL WHERE id = ?').run(jobId);
    return;
  }
  const next = nextRunFromCron(cronPreset);
  db.prepare('UPDATE jobs SET next_run_at = ? WHERE id = ?').run(next, jobId);

  if (usingBull) {
    const expr = CRON_EXPR[cronPreset];
    if (expr) {
      await bullQueue.add(
        'scrape',
        { jobId },
        {
          jobId: `repeat:${jobId}`,
          repeat: { pattern: expr },
          removeOnComplete: 50,
          removeOnFail: 50,
        }
      );
    }
  } else {
    armInMemory(jobId, cronPreset);
  }
}

function armInMemory(jobId, cronPreset) {
  const tick = async () => {
    inMemoryTimers.delete(jobId);
    try { await runJob(jobId); }
    catch (e) { console.error(`[scheduler] ${jobId} failed:`, e.message); }
    // re-arm if still scheduled
    const j = db.prepare('SELECT cron, status FROM jobs WHERE id = ?').get(jobId);
    if (j && j.status !== 'paused' && j.cron !== 'manual') armInMemory(jobId, j.cron);
  };
  const next = nextRunFromCron(cronPreset);
  db.prepare('UPDATE jobs SET next_run_at = ? WHERE id = ?').run(next, jobId);
  const delay = Math.max(1000, next - now());
  const t = setTimeout(tick, delay);
  inMemoryTimers.set(jobId, t);
}

export async function unscheduleJob(jobId) {
  const t = inMemoryTimers.get(jobId);
  if (t) { clearTimeout(t); inMemoryTimers.delete(jobId); }
  if (usingBull && bullQueue) {
    try { await bullQueue.removeRepeatableByKey?.(`repeat:${jobId}`); } catch {}
    try {
      const repeatables = await bullQueue.getRepeatableJobs();
      for (const r of repeatables) {
        if (r.id === `repeat:${jobId}` || r.name === `repeat:${jobId}`) {
          await bullQueue.removeRepeatableByKey(r.key);
        }
      }
    } catch {}
  }
}

export async function enqueueRunNow(jobId) {
  if (usingBull && bullQueue) {
    await bullQueue.add('scrape-now', { jobId }, { removeOnComplete: 20 });
    return { queued: true };
  }
  // fire-and-await for in-memory
  return await runJob(jobId);
}

export function isUsingBull() { return usingBull; }
