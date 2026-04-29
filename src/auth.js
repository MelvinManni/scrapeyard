import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { db, now } from './db.js';

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const SESSION_DAYS = parseInt(process.env.SESSION_DAYS || '14', 10);

export function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

export function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    SECRET,
    { expiresIn: `${SESSION_DAYS}d` }
  );
}

export function verifyToken(token) {
  try { return jwt.verify(token, SECRET); }
  catch { return null; }
}

export function ensureAdmin() {
  const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (count > 0) return;
  const email = process.env.ADMIN_EMAIL || 'admin@acme.io';
  const password = process.env.ADMIN_PASSWORD || 'admin';
  const name = process.env.ADMIN_NAME || 'Admin';
  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, team, role, active, created_at)
    VALUES (?, ?, ?, ?, ?, 'admin', 1, ?)
  `).run(randomUUID(), name, email.toLowerCase(), hashPassword(password), 'Engineering', now());
  console.log(`[auth] seeded admin: ${email} / ${password}`);
}

function readToken(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  return req.cookies?.sy_token || null;
}

export function authenticate(req, res, next) {
  const token = readToken(req);
  const claims = token ? verifyToken(token) : null;
  if (!claims) return res.status(401).json({ error: 'unauthenticated' });
  const user = db.prepare('SELECT id, name, email, team, role, active FROM users WHERE id = ?').get(claims.sub);
  if (!user || !user.active) return res.status(401).json({ error: 'unauthenticated' });
  db.prepare('UPDATE users SET last_active_at = ? WHERE id = ?').run(now(), user.id);
  req.user = user;
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'admin only' });
  next();
}
