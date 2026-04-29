import { Router } from 'express';
import { randomUUID, randomBytes } from 'node:crypto';
import { db, now } from '../db.js';
import { authenticate, requireAdmin, hashPassword } from '../auth.js';

const r = Router();
r.use(authenticate, requireAdmin);

function relTime(t) {
  if (!t) return 'never';
  const diff = Date.now() - t;
  const m = Math.round(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

r.get('/requests', (req, res) => {
  const rows = db.prepare(
    `SELECT * FROM access_requests WHERE status = 'pending' ORDER BY created_at DESC`
  ).all();
  res.json({
    requests: rows.map(r => ({
      id: r.id, name: r.name, email: r.email, team: r.team || '—',
      reason: r.reason || '', requested: relTime(r.created_at),
    })),
  });
});

r.post('/requests/:id/approve', (req, res) => {
  const reqRow = db.prepare('SELECT * FROM access_requests WHERE id = ?').get(req.params.id);
  if (!reqRow) return res.status(404).json({ error: 'not found' });
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(reqRow.email.toLowerCase());
  if (existing) {
    db.prepare(`UPDATE access_requests SET status = 'approved' WHERE id = ?`).run(reqRow.id);
    return res.json({ ok: true, alreadyMember: true });
  }
  const tempPassword = randomBytes(6).toString('base64url');
  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, team, role, active, created_at)
    VALUES (?, ?, ?, ?, ?, 'member', 1, ?)
  `).run(randomUUID(), reqRow.name, reqRow.email.toLowerCase(),
         hashPassword(tempPassword), reqRow.team, now());
  db.prepare(`UPDATE access_requests SET status = 'approved' WHERE id = ?`).run(reqRow.id);
  res.json({ ok: true, tempPassword });
});

r.post('/requests/:id/deny', (req, res) => {
  const out = db.prepare(`UPDATE access_requests SET status = 'denied' WHERE id = ? AND status = 'pending'`).run(req.params.id);
  if (!out.changes) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

r.get('/users', (req, res) => {
  const rows = db.prepare(`SELECT * FROM users ORDER BY created_at DESC`).all();
  res.json({
    users: rows.map(u => ({
      id: u.id, name: u.name, email: u.email,
      team: u.team || '—',
      role: u.role === 'admin' ? 'Admin' : 'Member',
      last: relTime(u.last_active_at || u.created_at),
      active: !!u.active,
    })),
  });
});

r.post('/users', (req, res) => {
  const { name, email, team, role, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' });
  const id = randomUUID();
  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, team, role, active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
  `).run(id, name, email.toLowerCase(), hashPassword(password), team || null,
         role === 'admin' ? 'admin' : 'member', now());
  res.status(201).json({ ok: true, id });
});

r.patch('/users/:id', (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'not found' });
  const { active, role } = req.body || {};
  if (typeof active === 'boolean') db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active ? 1 : 0, u.id);
  if (role === 'admin' || role === 'member') db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, u.id);
  res.json({ ok: true });
});

export default r;
