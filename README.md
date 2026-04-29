# Scrape Yard

A lightweight, internal scraping tool: keyword-driven cron scrapes with
prompt-filtered results. Implements the [Scrape Yard design](./public/index.html)
end-to-end — sign-in, request access, dashboard, job builder, results view, and
admin in a single Node.js application.

```
┌── frontend (React + Babel from CDN) ─────────────────┐
│  Mobile-first SPA, design-faithful                   │
└──────────────────┬───────────────────────────────────┘
                   │ /api/*
┌──────────────────▼───────────────────────────────────┐
│  Express server                                      │
│  ├── auth (bcrypt + JWT cookie)                      │
│  ├── jobs CRUD + run-now + results + filter         │
│  └── admin (access requests, members)               │
└──┬───────────────────────────────────┬───────────────┘
   │                                   │
   ▼                                   ▼
┌─────────────────┐         ┌──────────────────────────┐
│ SQLite (WAL)    │         │ BullMQ + Redis           │
│ users / jobs /  │         │ repeating cron jobs       │
│ runs / results  │         │ (in-memory fallback)      │
└─────────────────┘         └────────┬──────────────────┘
                                     │
                                     ▼
                            ┌──────────────────────┐
                            │ scraper              │
                            │ Cheerio (fast path)  │
                            │ Playwright (fallback)│
                            └──────────────────────┘
```

## Quick start

```bash
cp .env.example .env
npm install
npm start
# → open http://localhost:3000
# → sign in with the seeded admin (default admin@acme.io / admin)
```

That's it. No Redis required — without `REDIS_URL` the scheduler runs
in-process (great for dev and small deployments). Set `REDIS_URL` to switch
to BullMQ-backed scheduling for production.

## Stack

- **Express 4** — HTTP server, ~25 KB.
- **better-sqlite3** — single-file persistence, synchronous, very fast.
- **bcryptjs** + **jsonwebtoken** — auth (cookie + bearer).
- **BullMQ** — production cron scheduling (Redis). Optional.
- **undici** — fast `fetch` for HTTP.
- **Cheerio** — primary HTML/XML parser. Used for Google News RSS and
  OpenGraph extraction.
- **Playwright** — heavy fallback for JS-rendered pages
  (`renderWithPlaywright(url)`). Lazy-loaded — install browsers only if you
  actually need it (`npx playwright install chromium`).

## Features

| Feature | Where |
|---|---|
| Sign-in (email + password, JWT cookie) | `/api/auth/signin` · `SignInScreen` |
| Request access (no account → admin queue) | `/api/auth/request-access` · `RequestAccessScreen` |
| Dashboard — saved jobs with last/next run | `GET /api/jobs` · `DashboardScreen` / `DesktopJobsView` |
| New / edit job — keywords, cron, filter prompt | `POST /api/jobs` · `JobBuilderScreen` |
| Cron presets — hourly, daily, weekly, manual | `runJob.js#CRON_EXPR` |
| Run-now (manual trigger) | `POST /api/jobs/:id/run` |
| Pause / resume jobs | `PATCH /api/jobs/:id` `{status}` |
| Results view with filter prompt | `POST /api/jobs/:id/filter` · `ResultsScreen` / `DesktopResultsView` |
| AI filter prompts (Claude) — optional | `filter.js` (set `ANTHROPIC_API_KEY`) |
| Heuristic filter fallback (no API key) | `filter.js#heuristicFilter` |
| Run history per job | `GET /api/jobs/:id/runs` |
| Admin: pending access requests | `GET /api/admin/requests` · `AdminScreen` / `DesktopAdminView` |
| Admin: approve creates user with temp password | `POST /api/admin/requests/:id/approve` |
| Admin: members list with role / last active | `GET /api/admin/users` |
| Mobile-first responsive (< 900 px = phone, ≥ 900 px = desktop sidebar) | `useViewport` |

## REST API

All endpoints are namespaced under `/api`. Auth is via the `sy_token` cookie
(set on sign-in) or `Authorization: Bearer <jwt>`.

### auth (public)
- `POST /api/auth/signin` `{email, password}` → `{token, user}` (also sets cookie)
- `POST /api/auth/signout` → clears cookie
- `POST /api/auth/request-access` `{name, email, team?, reason?}`
- `GET  /api/auth/me` → `{user}`

### jobs (member)
- `GET  /api/jobs`
- `POST /api/jobs` `{name, keywords[], cron, filterPrompt?}`
- `GET  /api/jobs/:id`
- `PATCH /api/jobs/:id` `{name?, keywords?, cron?, filterPrompt?, status?}`
- `DELETE /api/jobs/:id`
- `POST /api/jobs/:id/run` — trigger immediate run
- `GET  /api/jobs/:id/results`
- `POST /api/jobs/:id/filter` `{prompt}` → returns filtered (in-memory) result set
- `GET  /api/jobs/:id/runs` — recent run history

### admin (admin only)
- `GET  /api/admin/requests`
- `POST /api/admin/requests/:id/approve` → returns `tempPassword` for the new user
- `POST /api/admin/requests/:id/deny`
- `GET  /api/admin/users`
- `POST /api/admin/users` `{name, email, password, team?, role?}`
- `PATCH /api/admin/users/:id` `{active?, role?}`

## Configuration

| Env var | Default | Notes |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `JWT_SECRET` | `dev-secret-change-me` | **change in production** |
| `SESSION_DAYS` | `14` | cookie/jwt lifetime |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | `admin@acme.io` / `admin` / `Admin` | seeded only if no users exist |
| `DB_PATH` | `./data/scrape-yard.db` | SQLite file |
| `REDIS_URL` | _(unset)_ | enable BullMQ scheduling |
| `USER_AGENT` | `ScrapeYard/1.0` | HTTP UA for the scraper |
| `DEFAULT_LOCALE` / `DEFAULT_REGION` | `en-US` / `US` | Google News locale/region |
| `ANTHROPIC_API_KEY` | _(unset)_ | enables LLM-backed filter prompts |
| `ANTHROPIC_MODEL` | `claude-haiku-4-5-20251001` | model for filter |

## Production notes

- **Switch to BullMQ:** set `REDIS_URL=redis://...`. The scheduler converts the
  preset into a BullMQ repeatable job and a worker (concurrency 4) consumes
  them. The in-memory fallback uses `setTimeout` and is fine for dev.
- **Playwright browsers:** the scraper does not invoke Playwright by default
  (Google News RSS is JS-free). If you add a custom scraper that calls
  `renderWithPlaywright(url)`, run `npx playwright install chromium` to fetch
  the browser binary.
- **Secrets:** rotate `JWT_SECRET` and the seeded admin password on first
  deploy.
- **Frontend build:** the SPA loads React, ReactDOM, and Babel from a CDN —
  zero build step. To eliminate Babel-in-browser, prebuild `app.jsx` with esbuild
  and swap the script tag to `<script src="app.js"></script>`.
