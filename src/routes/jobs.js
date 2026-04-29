import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db, now } from '../db.js';
import { authenticate } from '../auth.js';
import { scheduleJob, unscheduleJob, enqueueRunNow } from '../queue/scheduler.js';
import { applyFilter } from '../filter.js';

const r = Router();
r.use(authenticate);

const VALID_CRON = new Set(['hourly', 'daily', 'weekly', 'manual']);

function relTime(t) {
  if (!t) return null;
  const diff = Date.now() - t;
  const m = Math.round(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

function relUntil(t) {
  if (!t) return null;
  const diff = t - Date.now();
  if (diff <= 0) return 'soon';
  const m = Math.round(diff / 60000);
  if (m < 60) return `in ${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `in ${h}h`;
  const d = Math.round(h / 24);
  return `in ${d}d`;
}

function cronLabel(c) {
  return ({
    hourly: 'Hourly',
    daily: 'Daily · 09:00',
    weekly: 'Weekly · Mon 08:00',
    manual: 'Manual',
  })[c] || c;
}

function shapeJob(j) {
  const resultsCount = db.prepare(
    'SELECT COUNT(*) as c FROM results WHERE job_id = ? AND hidden = 0'
  ).get(j.id).c;
  return {
    id: j.id,
    name: j.name,
    keywords: JSON.parse(j.keywords_json),
    cron: j.cron,
    cronLabel: cronLabel(j.cron),
    status: j.status,
    filterPrompt: j.filter_prompt || '',
    lastRun: j.last_run_at ? relTime(j.last_run_at) : 'never',
    nextRun: j.status === 'paused' ? 'paused' : (j.next_run_at ? relUntil(j.next_run_at) : 'manual'),
    results: resultsCount,
    lastError: j.last_error || null,
    ownerId: j.owner_id,
    createdAt: j.created_at,
  };
}

r.get('/', (req, res) => {
  const rows = db.prepare(
    `SELECT * FROM jobs WHERE owner_id = ? ORDER BY created_at DESC`
  ).all(req.user.id);
  res.json({ jobs: rows.map(shapeJob) });
});

r.post('/', async (req, res) => {
  const { name, keywords, cron, filterPrompt } = req.body || {};
  if (!name || !Array.isArray(keywords) || !keywords.length) {
    return res.status(400).json({ error: 'name and keywords required' });
  }
  if (!VALID_CRON.has(cron)) return res.status(400).json({ error: 'invalid cron preset' });

  const id = randomUUID();
  db.prepare(`
    INSERT INTO jobs (id, owner_id, name, keywords_json, cron, filter_prompt, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'running', ?)
  `).run(id, req.user.id, name.trim(), JSON.stringify(keywords), cron, filterPrompt || null, now());

  await scheduleJob(id, cron);
  const j = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
  res.status(201).json({ job: shapeJob(j) });
});

r.get('/:id', (req, res) => {
  const j = db.prepare('SELECT * FROM jobs WHERE id = ? AND owner_id = ?').get(req.params.id, req.user.id);
  if (!j) return res.status(404).json({ error: 'not found' });
  res.json({ job: shapeJob(j) });
});

r.patch('/:id', async (req, res) => {
  const j = db.prepare('SELECT * FROM jobs WHERE id = ? AND owner_id = ?').get(req.params.id, req.user.id);
  if (!j) return res.status(404).json({ error: 'not found' });

  const fields = {};
  if (typeof req.body.name === 'string') fields.name = req.body.name.trim();
  if (Array.isArray(req.body.keywords)) fields.keywords_json = JSON.stringify(req.body.keywords);
  if (typeof req.body.filterPrompt === 'string') fields.filter_prompt = req.body.filterPrompt;
  if (typeof req.body.cron === 'string') {
    if (!VALID_CRON.has(req.body.cron)) return res.status(400).json({ error: 'invalid cron preset' });
    fields.cron = req.body.cron;
  }
  if (req.body.status === 'paused' || req.body.status === 'running') fields.status = req.body.status;

  const keys = Object.keys(fields);
  if (keys.length) {
    const setSql = keys.map(k => `${k} = ?`).join(', ');
    db.prepare(`UPDATE jobs SET ${setSql} WHERE id = ?`).run(...keys.map(k => fields[k]), j.id);
  }
  const updated = db.prepare('SELECT * FROM jobs WHERE id = ?').get(j.id);
  if (fields.cron || fields.status) {
    if (updated.status === 'paused') await unscheduleJob(j.id);
    else await scheduleJob(j.id, updated.cron);
  }
  res.json({ job: shapeJob(updated) });
});

r.delete('/:id', async (req, res) => {
  const j = db.prepare('SELECT id FROM jobs WHERE id = ? AND owner_id = ?').get(req.params.id, req.user.id);
  if (!j) return res.status(404).json({ error: 'not found' });
  await unscheduleJob(j.id);
  db.prepare('DELETE FROM jobs WHERE id = ?').run(j.id);
  res.json({ ok: true });
});

r.post('/:id/run', async (req, res) => {
  const j = db.prepare('SELECT id FROM jobs WHERE id = ? AND owner_id = ?').get(req.params.id, req.user.id);
  if (!j) return res.status(404).json({ error: 'not found' });
  try {
    const out = await enqueueRunNow(j.id);
    res.json({ ok: true, ...out });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

r.get('/:id/results', (req, res) => {
  const j = db.prepare('SELECT id, name, cron, filter_prompt, status, last_run_at, next_run_at, keywords_json FROM jobs WHERE id = ? AND owner_id = ?')
    .get(req.params.id, req.user.id);
  if (!j) return res.status(404).json({ error: 'not found' });
  const rows = db.prepare(
    `SELECT * FROM results WHERE job_id = ? AND hidden = 0 ORDER BY COALESCE(published_at, fetched_at) DESC LIMIT 200`
  ).all(j.id);

  res.json({
    job: {
      id: j.id, name: j.name, cron: j.cron, cronLabel: cronLabel(j.cron),
      filterPrompt: j.filter_prompt || '', status: j.status,
      keywords: JSON.parse(j.keywords_json),
      lastRun: j.last_run_at ? relTime(j.last_run_at) : 'never',
      nextRun: j.status === 'paused' ? 'paused' : (j.next_run_at ? relUntil(j.next_run_at) : 'manual'),
    },
    results: rows.map(r => ({
      id: r.id,
      source: r.source,
      title: r.title,
      url: r.url,
      snippet: r.snippet,
      image: r.image_url,
      tag: r.tag,
      time: relTime(r.published_at || r.fetched_at),
      publishedAt: r.published_at,
    })),
  });
});

r.post('/:id/filter', async (req, res) => {
  const j = db.prepare('SELECT id FROM jobs WHERE id = ? AND owner_id = ?').get(req.params.id, req.user.id);
  if (!j) return res.status(404).json({ error: 'not found' });
  const prompt = (req.body?.prompt || '').toString();
  const rows = db.prepare(
    `SELECT * FROM results WHERE job_id = ? AND hidden = 0 ORDER BY COALESCE(published_at, fetched_at) DESC LIMIT 200`
  ).all(j.id);

  const items = rows.map(r => ({
    id: r.id, source: r.source, title: r.title, url: r.url,
    snippet: r.snippet, image: r.image_url, tag: r.tag,
    publishedAt: r.published_at,
  }));

  const out = await applyFilter({ prompt, items });
  const shaped = out.items.map(it => ({
    ...it,
    time: relTime(it.publishedAt || Date.now()),
  }));
  res.json({ results: shaped, mode: out.mode, prompt });
});

r.get('/:id/runs', (req, res) => {
  const j = db.prepare('SELECT id FROM jobs WHERE id = ? AND owner_id = ?').get(req.params.id, req.user.id);
  if (!j) return res.status(404).json({ error: 'not found' });
  const runs = db.prepare(
    `SELECT id, started_at, finished_at, status, results_count, duration_ms FROM runs
     WHERE job_id = ? ORDER BY started_at DESC LIMIT 20`
  ).all(j.id);
  res.json({
    runs: runs.map(r => ({
      id: r.id,
      startedAt: r.started_at,
      time: relTime(r.started_at),
      duration: r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : '—',
      count: r.results_count,
      status: r.status,
    })),
  });
});

export default r;
