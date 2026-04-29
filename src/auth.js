import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { prisma, now } from './db.js';

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

export async function ensureAdmin() {
  const count = await prisma.user.count();
  if (count > 0) return;
  const email = process.env.ADMIN_EMAIL || 'admin@acme.io';
  const password = process.env.ADMIN_PASSWORD || 'admin';
  const name = process.env.ADMIN_NAME || 'Admin';
  await prisma.user.create({
    data: {
      id: randomUUID(),
      name,
      email: email.toLowerCase(),
      passwordHash: hashPassword(password),
      team: 'Engineering',
      role: 'admin',
      active: true,
      createdAt: BigInt(now()),
    },
  });
  console.log(`[auth] seeded admin: ${email} / ${password}`);
}

function readToken(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  return req.cookies?.sy_token || null;
}

export async function authenticate(req, res, next) {
  try {
    const token = readToken(req);
    const claims = token ? verifyToken(token) : null;
    if (!claims) return res.status(401).json({ error: 'unauthenticated' });
    const user = await prisma.user.findUnique({
      where: { id: claims.sub },
      select: { id: true, name: true, email: true, team: true, role: true, active: true },
    });
    if (!user || !user.active) return res.status(401).json({ error: 'unauthenticated' });
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: BigInt(now()) },
    });
    req.user = user;
    next();
  } catch (e) { next(e); }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'admin only' });
  next();
}
