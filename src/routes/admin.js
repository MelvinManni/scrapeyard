import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { prisma, now, toNum } from '../db.js';
import { authenticate, requireAdmin } from '../auth.js';

const r = Router();
r.use(authenticate, requireAdmin);

function relTime(t) {
  if (!t) return 'never';
  const diff = Date.now() - Number(t);
  const m = Math.round(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

r.get('/requests', async (req, res, next) => {
  try {
    const rows = await prisma.accessRequest.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      requests: rows.map(r => ({
        id: r.id, name: r.name, email: r.email, team: r.team || '—',
        reason: r.reason || '', requested: relTime(toNum(r.createdAt)),
      })),
    });
  } catch (e) { next(e); }
});

r.post('/requests/:id/approve', async (req, res, next) => {
  try {
    const reqRow = await prisma.accessRequest.findUnique({ where: { id: req.params.id } });
    if (!reqRow) return res.status(404).json({ error: 'not found' });
    const existing = await prisma.user.findUnique({
      where: { email: reqRow.email.toLowerCase() },
      select: { id: true },
    });
    if (existing) {
      await prisma.accessRequest.update({
        where: { id: reqRow.id },
        data: { status: 'approved' },
      });
      return res.json({ ok: true, alreadyMember: true });
    }
    await prisma.user.create({
      data: {
        id: randomUUID(),
        name: reqRow.name,
        email: reqRow.email.toLowerCase(),
        passwordHash: reqRow.passwordHash,
        team: reqRow.team,
        role: 'member',
        active: true,
        createdAt: BigInt(now()),
      },
    });
    await prisma.accessRequest.update({
      where: { id: reqRow.id },
      data: { status: 'approved' },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

r.post('/requests/:id/deny', async (req, res, next) => {
  try {
    const out = await prisma.accessRequest.updateMany({
      where: { id: req.params.id, status: 'pending' },
      data: { status: 'denied' },
    });
    if (!out.count) return res.status(404).json({ error: 'not found' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

r.get('/users', async (req, res, next) => {
  try {
    const rows = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({
      users: rows.map(u => ({
        id: u.id, name: u.name, email: u.email,
        team: u.team || '—',
        role: u.role === 'admin' ? 'Admin' : 'Member',
        last: relTime(toNum(u.lastActiveAt) || toNum(u.createdAt)),
        active: !!u.active,
      })),
    });
  } catch (e) { next(e); }
});

r.post('/users', async (req, res, next) => {
  try {
    const { name, email, team, role, password } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' });
    const id = randomUUID();
    await prisma.user.create({
      data: {
        id,
        name,
        email: email.toLowerCase(),
        passwordHash: hashPassword(password),
        team: team || null,
        role: role === 'admin' ? 'admin' : 'member',
        active: true,
        createdAt: BigInt(now()),
      },
    });
    res.status(201).json({ ok: true, id });
  } catch (e) { next(e); }
});

r.patch('/users/:id', async (req, res, next) => {
  try {
    const u = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!u) return res.status(404).json({ error: 'not found' });
    const { active, role } = req.body || {};
    const data = {};
    if (typeof active === 'boolean') data.active = active;
    if (role === 'admin' || role === 'member') data.role = role;
    if (Object.keys(data).length) {
      await prisma.user.update({ where: { id: u.id }, data });
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default r;
