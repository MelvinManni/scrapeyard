import { randomUUID } from 'node:crypto';
import { prisma, now } from '../db.js';
import { runScrape } from '../scraper/index.js';
import { applyFilter } from '../filter.js';

export async function runJob(jobId) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new Error(`job ${jobId} not found`);
  if (job.status === 'paused') return { skipped: true };

  const runId = randomUUID();
  const startedAt = now();
  await prisma.run.create({
    data: {
      id: runId,
      jobId: job.id,
      startedAt: BigInt(startedAt),
      status: 'running',
    },
  });

  try {
    const keywords = JSON.parse(job.keywordsJson);
    const { items, errors } = await runScrape({ keywords });

    // Apply the configured filter only when an LLM is available — heuristic
    // filtering at scrape time is too risky (we'd drop data we can't recover).
    // Without LLM, we store everything and let the view-time filter handle it.
    let kept = items;
    if (job.filterPrompt && process.env.ANTHROPIC_API_KEY) {
      const out = await applyFilter({ prompt: job.filterPrompt, items });
      kept = out.items;
    }

    const fetchedAt = now();
    let inserted = 0;
    if (kept.length) {
      const created = await prisma.result.createMany({
        data: kept.map(r => ({
          id: randomUUID(),
          jobId: job.id,
          runId,
          source: r.source,
          title: r.title,
          url: r.url,
          snippet: r.snippet,
          imageUrl: r.image_url || null,
          tag: r.tag || null,
          publishedAt: r.published_at ? BigInt(r.published_at) : null,
          fetchedAt: BigInt(fetchedAt),
          urlHash: r.url_hash,
        })),
        skipDuplicates: true,
      });
      inserted = created.count;
    }

    const finishedAt = now();
    const status = errors.length && !inserted ? 'error' : 'ok';
    await prisma.run.update({
      where: { id: runId },
      data: {
        finishedAt: BigInt(finishedAt),
        status,
        resultsCount: inserted,
        durationMs: finishedAt - startedAt,
        error: errors.length ? JSON.stringify(errors) : null,
      },
    });

    await prisma.job.update({
      where: { id: job.id },
      data: {
        lastRunAt: BigInt(finishedAt),
        lastError: errors.length ? JSON.stringify(errors) : null,
        // Recover from a previous 'error' status; leave 'paused' alone.
        ...(job.status === 'error' ? { status: 'running' } : {}),
      },
    });

    return { runId, inserted, total: kept.length, errors };
  } catch (err) {
    const finishedAt = now();
    await prisma.run.update({
      where: { id: runId },
      data: {
        finishedAt: BigInt(finishedAt),
        status: 'error',
        error: String(err.message || err),
        durationMs: finishedAt - startedAt,
      },
    });
    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'error', lastError: String(err.message || err) },
    });
    throw err;
  }
}

export const CRON_EXPR = {
  hourly: '0 * * * *',
  daily: '0 9 * * *',
  weekly: '0 8 * * 1',
  manual: null,
};

export function nextRunFromCron(preset, from = Date.now()) {
  const d = new Date(from);
  switch (preset) {
    case 'hourly': {
      const n = new Date(d);
      n.setMinutes(0, 0, 0);
      n.setHours(n.getHours() + 1);
      return n.getTime();
    }
    case 'daily': {
      const n = new Date(d);
      n.setHours(9, 0, 0, 0);
      if (n.getTime() <= from) n.setDate(n.getDate() + 1);
      return n.getTime();
    }
    case 'weekly': {
      const n = new Date(d);
      n.setHours(8, 0, 0, 0);
      const day = n.getDay(); // 0=Sun..6=Sat
      const offset = (1 - day + 7) % 7 || 7; // next Monday
      n.setDate(n.getDate() + offset);
      return n.getTime();
    }
    default: return null;
  }
}
