import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { ensureAdmin } from './auth.js';
import { initScheduler, isUsingBull } from './queue/scheduler.js';
import { prisma } from './db.js';

import authRoutes from './routes/auth.js';
import jobsRoutes from './routes/jobs.js';
import adminRoutes from './routes/admin.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '512kb' }));
app.use(cookieParser());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, scheduler: isUsingBull() ? 'bullmq' : 'in-memory' });
});

app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/admin', adminRoutes);

app.use((err, req, res, next) => {
  console.error('[error]', err);
  res.status(500).json({ error: err.message || 'server error' });
});

app.use(express.static(join(__dirname, '..', 'public')));
app.get(/^\/(?!api\/).*/, (req, res) => {
  res.sendFile(join(__dirname, '..', 'public', 'index.html'));
});

(async () => {
  try {
    await prisma.$connect();
    await ensureAdmin();
    await initScheduler();
    app.listen(PORT, () => {
      console.log(`Scrape Yard listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('[startup] failed:', err);
    process.exit(1);
  }
})();

const shutdown = async () => {
  try { await prisma.$disconnect(); } catch {}
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
