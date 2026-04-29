import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db, now } from '../db.js';
import { hashPassword, verifyPassword, signToken, authenticate } from '../auth.js';

const r = Router();

r.post('/signin', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase());
  if (!user || !user.active) return res.status(401).json({ error: 'invalid credentials' });
  if (!verifyPassword(password, user.password_hash)) return res.status(401).json({ error: 'invalid credentials' });

  const token = signToken(user);
  res.cookie('sy_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 14,
  });
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, team: user.team },
  });
});

r.post('/signout', (req, res) => {
  res.clearCookie('sy_token');
  res.json({ ok: true });
});

r.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

r.post('/request-access', (req, res) => {
  const { name, email, team, reason } = req.body || {};
  if (!name || !email) return res.status(400).json({ error: 'name and email required' });
  const id = randomUUID();
  db.prepare(`
    INSERT INTO access_requests (id, name, email, team, reason, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?)
  `).run(id, name, String(email).toLowerCase(), team || null, reason || null, now());
  res.json({ ok: true, id });
});

export default r;
