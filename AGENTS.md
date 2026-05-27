# Clarus — Codex Context

## Project Overview

Clarus is an AI-powered academic copilot for D2L/Brightspace. It syncs a student's LMS, detects changes (due dates, rubrics, instructions), forecasts heavy weeks, and navigates students to the exact content they need.

- **Phase 1 MVP:** D2L connection, course sync, dashboard
- **Phase 2+:** Assignment breakdown, semantic content map, workload forecasting, AI study planner

## Repo Structure

```
clarus/
├── FE/                          # Next.js 15 frontend (port 3000)
├── BE/
│   ├── api/                     # Fastify 5 API server (port 4001)
│   ├── connector/               # Playwright-based D2L connector (port 4002)
│   └── docker-compose.yml       # PostgreSQL 16 (host port 5433)
├── docs/
│   ├── workstreams.md           # Feature lane/task structure
│   └── feature-matrix.md       # Owner/route/API matrix for all 15 features
├── scripts/                     # Cross-platform dev scripts
└── README.md                    # Full setup and troubleshooting guide
```

## Tech Stack

| Layer | Stack |
|-------|-------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS 3, Recharts, Framer Motion, Lucide |
| Backend API | Fastify 5, TypeScript, Prisma 6, PostgreSQL 16 |
| Connector | Fastify 5, Playwright 1.51 |
| Auth | JWT sessions via cookies, bcryptjs (passwords), crypto-js AES (D2L state) |
| Validation | Zod (all BE/api routes) |

## Dev Server Startup

Before working on any feature, verify all three services are running:

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:4001 |
| Connector | http://localhost:4002 |

**If any service is not responding, start the full stack from the repo root:**

```bash
npm run dev
```

**First time or after a fresh clone, run setup first:**

```bash
npm run setup   # installs deps, starts Docker Postgres, runs Prisma migrations
npm run dev
```

**Stop all dev servers (Windows):**

On Windows, `Ctrl+C` may not fully kill all processes. Kill by port explicitly:

```bash
# Find and kill PIDs on each port, then verify
netstat -ano | grep -E ":3000|:4001|:4002"
# Then for each PID listed:
taskkill //F //PID <pid>
```

Or kill all Node processes at once (caution — kills every node.exe):

```bash
taskkill //F //IM node.exe
```

**Stop Postgres when done:**

```bash
npm run db:down
```

## Key Commands

| Task | Command | Working Dir |
|------|---------|-------------|
| Start all services | `npm run dev` | repo root |
| First-time setup | `npm run setup` | repo root |
| Stop Postgres | `npm run db:down` | repo root |
| Frontend only | `npm run dev:fe` | repo root |
| Backend only | `npm run dev:be` | repo root |
| Frontend lint | `npm run lint` | `FE/` |
| Frontend build | `npm run build` | `FE/` |
| API build | `npm run build` | `BE/api/` |
| Push Prisma schema | `npx prisma db push` | `BE/api/` |
| Regen Prisma client | `npm run prisma:generate` | `BE/api/` |
| Chrome for Playwright | `npm run chrome:debug` | repo root |

## Environment Variables

See README.md for exact values. Three `.env` files are required:

- `BE/api/.env` — `PORT`, `DATABASE_URL`, `ENCRYPTION_KEY`, `SESSION_SECRET`, `CORS_ORIGIN`, `CONNECTOR_URL`, `CONNECTOR_INTERNAL_SECRET`
- `BE/connector/.env` — `PORT`, `CONNECTOR_INTERNAL_SECRET`, `PLAYWRIGHT_*` settings, `BS_*` selectors
- `FE/.env.local` — `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_DEFAULT_INSTANCE_URL`

The API server throws on startup if any required env vars are missing.

## Architecture Notes

### Authentication Flow
1. User clicks "Connect D2L" — Playwright opens a popup pointing to the institution's Brightspace login
2. User signs in manually (Clarus never receives credentials)
3. Playwright captures encrypted `storageState` (cookies + localStorage) → stored in Postgres
4. Optional fallback: credentials forwarded once in-memory (never persisted)

### Service Communication
- Frontend → API: HTTP with signed session cookies
- API → Connector: HTTP POST with `x-internal-secret` header (value must match `CONNECTOR_INTERNAL_SECRET` in both envs)
- All API routes are prefixed `/v1`

### Database
- PostgreSQL 16 managed via Docker (`BE/docker-compose.yml`)
- Prisma schema: `BE/api/prisma/schema.prisma`
- After any schema change: `npx prisma db push && npm run prisma:generate` from `BE/api/`
- Key models: `User`, `Session`, `Course`, `CalendarEvent`, `TimelineEvent`, `AiBrief`, `ItemState`, `CopilotThread`, `CopilotMessage`, `SyncLog`

### Frontend Structure
- App Router at `FE/app/`
- Dashboard route: `FE/app/dashboard/`
- Feature workspace dirs: `FE/app/dashboard/(member-1-foundation-modeling)/`, `(member-2-intelligence-layer)/`, `(member-3-optimization-experience)/`
- API client: `FE/lib/api.ts`
- UI settings: `FE/lib/uiSettings.ts`

### Backend Structure
- Routes: `BE/api/src/routes/`
- Workstream feature routes: `BE/api/src/routes/workstreams/`
- Plugins (auth, CORS, cookies): `BE/api/src/plugins/`
- Shared utilities: `BE/api/src/lib/`

## Security Rules

These must never be violated:

- Never persist passwords (only bcrypt hash for Clarus accounts)
- Never log credentials or raw storageState
- Encrypt storageState at rest using crypto-js AES with `ENCRYPTION_KEY`
- All connector routes require the `x-internal-secret` header
- CORS is restricted to the configured `CORS_ORIGIN`

## Troubleshooting

- **Login fails (custom SSO/Duo):** Set `PLAYWRIGHT_HEADFUL=true`, `PLAYWRIGHT_SLOWMO_MS=100`, `PLAYWRIGHT_AUTH_WAIT_MS=180000` in `BE/connector/.env`
- **Playwright opens separate browser window:** Run `npm run chrome:debug` then set `PLAYWRIGHT_CONNECT_OVER_CDP=true` in connector env
- **Connector unavailable:** Verify it's running at port 4002 and both `CONNECTOR_INTERNAL_SECRET` values match
- **No courses after sync:** Confirm D2L account has active enrollments and re-run sync from the dashboard
- **Session expired:** Reconnect from `/login`
