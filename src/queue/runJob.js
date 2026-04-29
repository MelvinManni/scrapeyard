import { randomUUID } from 'node:crypto';
import { db, now } from '../db.js';
import { runScrape } from '../scraper/index.js';
import { applyFilter } from '../filter.js';

export async function runJob(jobId) {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
  if (!job) throw new Error(`job ${jobId} not found`);
  if (job.status === 'paused') return { skipped: true };

  const runId = randomUUID();
  const startedAt = now();
  db.prepare(`
    INSERT INTO runs (id, job_id, started_at, status) VALUES (?, ?, ?, 'running')
  `).run(runId, job.id, startedAt);

  try {
    const keywords = JSON.parse(job.keywords_json);
    const { items, errors } = await runScrape({ keywords });

    // Apply the configured filter only when an LLM is available — heuristic
    // filtering at scrape time is too risky (we'd drop data we can't recover).
    // Without LLM, we store everything and let the view-time filter handle it.
    let kept = items;
    if (job.filter_prompt && process.env.ANTHROPIC_API_KEY) {
      const out = await applyFilter({ prompt: job.filter_prompt, items });
      kept = out.items;
    }

    const insert = db.prepare(`
      INSERT OR IGNORE INTO results
        (id, job_id, run_id, source, title, url, snippet, image_url, tag, published_at, fetched_at, url_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const fetchedAt = now();
    let inserted = 0;
    const tx = db.transaction((rows) => {
      for (const r of rows) {
        const info = insert.run(
          randomUUID(), job.id, runId,
          r.source, r.title, r.url, r.snippet, r.image_url || null,
          r.tag || null, r.published_at || null, fetchedAt, r.url_hash
        );
        if (info.changes) inserted++;
      }
    });
    tx(kept);

    const finishedAt = now();
    const status = errors.length && !inserted ? 'error' : 'ok';
    db.prepare(`
      UPDATE runs SET finished_at = ?, status = ?, results_count = ?, duration_ms = ?, error = ?
      WHERE id = ?
    `).run(finishedAt, status, inserted, finishedAt - startedAt,
           errors.length ? JSON.stringify(errors) : null, runId);

    db.prepare(`
      UPDATE jobs SET last_run_at = ?, last_error = ?, status = CASE WHEN status = 'error' THEN 'running' ELSE status END
      WHERE id = ?
    `).run(finishedAt, errors.length ? JSON.stringify(errors) : null, job.id);

    return { runId, inserted, total: kept.length, errors };
  } catch (err) {
    const finishedAt = now();
    db.prepare(`
      UPDATE runs SET finished_at = ?, status = 'error', error = ?, duration_ms = ?
      WHERE id = ?
    `).run(finishedAt, String(err.message || err), finishedAt - startedAt, runId);
    db.prepare(`UPDATE jobs SET status = 'error', last_error = ? WHERE id = ?`)
      .run(String(err.message || err), job.id);
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
