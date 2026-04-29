import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma, now, toNum } from '../db.js';
import { authenticate } from '../auth.js';
import { scheduleJob, unscheduleJob, enqueueRunNow } from '../queue/scheduler.js';
import { applyFilter } from '../filter.js';

const r = Router();
r.use(authenticate);

const VALID_CRON = new Set(['hourly', 'daily', 'weekly', 'manual']);

function relTime(t) {
  if (!t) return null;
  const diff = Date.now() - Number(t);
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
  const diff = Number(t) - Date.now();
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

async function shapeJob(j) {
  const resultsCount = await prisma.result.count({
    where: { jobId: j.id, hidden: false },
  });
  return {
    id: j.id,
    name: j.name,
    keywords: JSON.parse(j.keywordsJson),
    cron: j.cron,
    cronLabel: cronLabel(j.cron),
    status: j.status,
    filterPrompt: j.filterPrompt || '',
    lastRun: j.lastRunAt ? relTime(toNum(j.lastRunAt)) : 'never',
    nextRun: j.status === 'paused'
      ? 'paused'
      : (j.nextRunAt ? relUntil(toNum(j.nextRunAt)) : 'manual'),
    results: resultsCount,
    lastError: j.lastError || null,
    ownerId: j.ownerId,
    createdAt: toNum(j.createdAt),
  };
}

r.get('/', async (req, res, next) => {
  try {
    const rows = await prisma.job.findMany({
      where: { ownerId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    const jobs = await Promise.all(rows.map(shapeJob));
    res.json({ jobs });
  } catch (e) { next(e); }
});

r.post('/', async (req, res, next) => {
  try {
    const { name, keywords, cron, filterPrompt } = req.body || {};
    if (!name || !Array.isArray(keywords) || !keywords.length) {
      return res.status(400).json({ error: 'name and keywords required' });
    }
    if (!VALID_CRON.has(cron)) return res.status(400).json({ error: 'invalid cron preset' });

    const id = randomUUID();
    await prisma.job.create({
      data: {
        id,
        ownerId: req.user.id,
        name: name.trim(),
        keywordsJson: JSON.stringify(keywords),
        cron,
        filterPrompt: filterPrompt || null,
        status: 'running',
        createdAt: BigInt(now()),
      },
    });

    await scheduleJob(id, cron);
    const j = await prisma.job.findUnique({ where: { id } });
    res.status(201).json({ job: await shapeJob(j) });
  } catch (e) { next(e); }
});

r.get('/:id', async (req, res, next) => {
  try {
    const j = await prisma.job.findFirst({
      where: { id: req.params.id, ownerId: req.user.id },
    });
    if (!j) return res.status(404).json({ error: 'not found' });
    res.json({ job: await shapeJob(j) });
  } catch (e) { next(e); }
});

r.patch('/:id', async (req, res, next) => {
  try {
    const j = await prisma.job.findFirst({
      where: { id: req.params.id, ownerId: req.user.id },
    });
    if (!j) return res.status(404).json({ error: 'not found' });

    const data = {};
    if (typeof req.body.name === 'string') data.name = req.body.name.trim();
    if (Array.isArray(req.body.keywords)) data.keywordsJson = JSON.stringify(req.body.keywords);
    if (typeof req.body.filterPrompt === 'string') data.filterPrompt = req.body.filterPrompt;
    if (typeof req.body.cron === 'string') {
      if (!VALID_CRON.has(req.body.cron)) return res.status(400).json({ error: 'invalid cron preset' });
      data.cron = req.body.cron;
    }
    if (req.body.status === 'paused' || req.body.status === 'running') data.status = req.body.status;

    if (Object.keys(data).length) {
      await prisma.job.update({ where: { id: j.id }, data });
    }
    const updated = await prisma.job.findUnique({ where: { id: j.id } });
    if (data.cron || data.status) {
      if (updated.status === 'paused') await unscheduleJob(j.id);
      else await scheduleJob(j.id, updated.cron);
    }
    res.json({ job: await shapeJob(updated) });
  } catch (e) { next(e); }
});

r.delete('/:id', async (req, res, next) => {
  try {
    const j = await prisma.job.findFirst({
      where: { id: req.params.id, ownerId: req.user.id },
      select: { id: true },
    });
    if (!j) return res.status(404).json({ error: 'not found' });
    await unscheduleJob(j.id);
    await prisma.job.delete({ where: { id: j.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

r.post('/:id/run', async (req, res, next) => {
  try {
    const j = await prisma.job.findFirst({
      where: { id: req.params.id, ownerId: req.user.id },
      select: { id: true },
    });
    if (!j) return res.status(404).json({ error: 'not found' });
    const out = await enqueueRunNow(j.id);
    res.json({ ok: true, ...out });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

r.get('/:id/results', async (req, res, next) => {
  try {
    const j = await prisma.job.findFirst({
      where: { id: req.params.id, ownerId: req.user.id },
    });
    if (!j) return res.status(404).json({ error: 'not found' });

    // Order by COALESCE(published_at, fetched_at) — Prisma can't express this,
    // so use raw SQL with the actual table/column names.
    const rows = await prisma.$queryRaw`
      SELECT id, source, title, url, snippet, image_url, tag, published_at, fetched_at
      FROM results
      WHERE job_id = ${j.id} AND hidden = false
      ORDER BY COALESCE(published_at, fetched_at) DESC
      LIMIT 200
    `;

    res.json({
      job: {
        id: j.id, name: j.name, cron: j.cron, cronLabel: cronLabel(j.cron),
        filterPrompt: j.filterPrompt || '', status: j.status,
        keywords: JSON.parse(j.keywordsJson),
        lastRun: j.lastRunAt ? relTime(toNum(j.lastRunAt)) : 'never',
        nextRun: j.status === 'paused'
          ? 'paused'
          : (j.nextRunAt ? relUntil(toNum(j.nextRunAt)) : 'manual'),
      },
      results: rows.map(r => ({
        id: r.id,
        source: r.source,
        title: r.title,
        url: r.url,
        snippet: r.snippet,
        image: r.image_url,
        tag: r.tag,
        time: relTime(toNum(r.published_at) || toNum(r.fetched_at)),
        publishedAt: r.published_at == null ? null : toNum(r.published_at),
      })),
    });
  } catch (e) { next(e); }
});

r.post('/:id/filter', async (req, res, next) => {
  try {
    const j = await prisma.job.findFirst({
      where: { id: req.params.id, ownerId: req.user.id },
      select: { id: true },
    });
    if (!j) return res.status(404).json({ error: 'not found' });
    const prompt = (req.body?.prompt || '').toString();
    const rows = await prisma.$queryRaw`
      SELECT id, source, title, url, snippet, image_url, tag, published_at, fetched_at
      FROM results
      WHERE job_id = ${j.id} AND hidden = false
      ORDER BY COALESCE(published_at, fetched_at) DESC
      LIMIT 200
    `;

    const items = rows.map(r => ({
      id: r.id, source: r.source, title: r.title, url: r.url,
      snippet: r.snippet, image: r.image_url, tag: r.tag,
      publishedAt: r.published_at == null ? null : toNum(r.published_at),
    }));

    const out = await applyFilter({ prompt, items });
    const shaped = out.items.map(it => ({
      ...it,
      time: relTime(it.publishedAt || Date.now()),
    }));
    res.json({ results: shaped, mode: out.mode, prompt });
  } catch (e) { next(e); }
});

r.get('/:id/runs', async (req, res, next) => {
  try {
    const j = await prisma.job.findFirst({
      where: { id: req.params.id, ownerId: req.user.id },
      select: { id: true },
    });
    if (!j) return res.status(404).json({ error: 'not found' });
    const runs = await prisma.run.findMany({
      where: { jobId: j.id },
      orderBy: { startedAt: 'desc' },
      take: 20,
      select: {
        id: true, startedAt: true, finishedAt: true, status: true,
        resultsCount: true, durationMs: true, error: true,
      },
    });
    res.json({
      runs: runs.map(r => ({
        id: r.id,
        startedAt: toNum(r.startedAt),
        time: relTime(toNum(r.startedAt)),
        duration: r.durationMs ? `${(r.durationMs / 1000).toFixed(1)}s` : '—',
        count: r.resultsCount,
        status: r.status,
        error: r.error,
      })),
    });
  } catch (e) { next(e); }
});

export default r;
