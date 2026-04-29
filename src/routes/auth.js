import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { prisma, now } from '../db.js';
import { hashPassword, verifyPassword, signToken, authenticate } from '../auth.js';

const r = Router();

r.post('/signin', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
    if (!user || !user.active) return res.status(401).json({ error: 'invalid credentials' });
    if (!verifyPassword(password, user.passwordHash)) return res.status(401).json({ error: 'invalid credentials' });

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
  } catch (e) { next(e); }
});

r.post('/signout', (req, res) => {
  res.clearCookie('sy_token');
  res.json({ ok: true });
});

r.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

r.post('/request-access', async (req, res, next) => {
  try {
    const { name, email, password, team, reason } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email, and password required' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'password must be at least 8 characters' });
    }
    const id = randomUUID();
    await prisma.accessRequest.create({
      data: {
        id,
        name,
        email: String(email).toLowerCase(),
        passwordHash: hashPassword(password),
        team: team || null,
        reason: reason || null,
        status: 'pending',
        createdAt: BigInt(now()),
      },
    });
    res.json({ ok: true, id });
  } catch (e) { next(e); }
});

export default r;
