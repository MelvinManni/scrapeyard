import { prisma, now } from '../db.js';
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
  const jobs = await prisma.job.findMany({ select: { id: true, cron: true, status: true } });
  for (const j of jobs) {
    if (j.status === 'paused') continue;
    await scheduleJob(j.id, j.cron);
  }
}

export async function scheduleJob(jobId, cronPreset) {
  await unscheduleJob(jobId);
  if (cronPreset === 'manual') {
    await prisma.job.update({ where: { id: jobId }, data: { nextRunAt: null } });
    return;
  }
  const next = nextRunFromCron(cronPreset);
  await prisma.job.update({ where: { id: jobId }, data: { nextRunAt: BigInt(next) } });

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
    await armInMemory(jobId, cronPreset);
  }
}

async function armInMemory(jobId, cronPreset) {
  const tick = async () => {
    inMemoryTimers.delete(jobId);
    try { await runJob(jobId); }
    catch (e) { console.error(`[scheduler] ${jobId} failed:`, e.message); }
    // re-arm if still scheduled
    const j = await prisma.job.findUnique({
      where: { id: jobId },
      select: { cron: true, status: true },
    });
    if (j && j.status !== 'paused' && j.cron !== 'manual') await armInMemory(jobId, j.cron);
  };
  const next = nextRunFromCron(cronPreset);
  await prisma.job.update({ where: { id: jobId }, data: { nextRunAt: BigInt(next) } });
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
