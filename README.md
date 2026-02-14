# Clarus

Clarus is an ai-powered control system for D2L/Brightspace that eliminates friction and tells students exactly what to do and where to find what they need.

## vision

Clarus is not just a planner. It is an ai academic copilot that:
- syncs your lms (D2L Brightspace)
- detects what changed (due dates, rubrics, instructions)
- breaks assignments into actionable tasks
- predicts heavy weeks (workload radar)
- generates study blocks
- tells students exactly where to find the right module, lecture, reading, or file

### ai academic navigation engine

The core differentiator is semantic academic navigation. Later phases ingest assignments, rubrics, module structure, announcements, discussion prompts, quiz topics, and linked resources to map:

`modules -> topics -> resources -> assignment actions`

When a student opens an assignment, Clarus aims to answer:

"to complete this, go to module 3 -> lecture 3.2 slides (pages 14-22), read chapter 6 elastic collisions, and review practice set #3 question 4."

Phase 1 delivers a hackathon-ready foundation for this system.

## phase 1 mvp scope

- connect to D2L via hackathon auth strategy (option b2)
- retrieve real enrolled courses through `/d2l/api/*` json
- show a clean dashboard command center
- keep architecture extensible for phase 2+ (assignments, content map, ai planning, change detection)

## auth strategy (hackathon option b2)

This repo uses:

`credentials -> playwright login -> d2l /d2l/api json`

Important constraints:
- no browser extension
- no html scraping for course data
- passwords are never persisted
- credentials exist only in memory during login attempt
- only encrypted Playwright `storageState` is stored in Postgres
- connector endpoints are protected by internal secret header

## repo structure

```text
Clarus/
├── FE/
├── BE/
│   ├── api/
│   ├── connector/
│   └── docker-compose.yml
└── README.md
```

## environment

### `BE/api/.env`

```env
PORT=4001
DATABASE_URL=postgresql://clarus:clarus@localhost:5433/clarus_dev
ENCRYPTION_KEY=generate-a-random-32+char-string
SESSION_SECRET=generate-another-random-32+char-string
CORS_ORIGIN=http://localhost:3000
CONNECTOR_URL=http://localhost:4002
CONNECTOR_INTERNAL_SECRET=super-secret-shared-string
```

### `BE/connector/.env`

```env
PORT=4002
CONNECTOR_INTERNAL_SECRET=super-secret-shared-string
PLAYWRIGHT_HEADFUL=false
PLAYWRIGHT_SLOWMO_MS=0
PLAYWRIGHT_AUTH_WAIT_MS=120000

BS_USER_SELECTOR=input[name="username"]
BS_PASS_SELECTOR=input[name="password"]
BS_SUBMIT_SELECTOR=button[type="submit"]
```

### `FE/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:4001
NEXT_PUBLIC_DEFAULT_INSTANCE_URL=https://yourschool.brightspace.com
```

## run instructions

### easiest path (single command)

from repo root:

```bash
npm run setup
npm run dev
```

this starts:
- postgres (docker)
- connector (`:4002`)
- api (`:4001`)
- frontend (`:3000`)

press `ctrl+c` in the terminal running `npm run dev` to stop app services.
postgres keeps running in docker until you run:

```bash
npm run db:down
```

### manual path

1) start postgres
```bash
cd BE
docker compose up -d
```

2) start connector
```bash
cd BE/connector
npm install
npm run dev
```

3) start api
```bash
cd BE/api
npm install
npx prisma db push
npm run dev
```

4) start frontend
```bash
cd FE
npm install
npm run dev
```

visit:

`http://localhost:3000`

## api endpoints

### public frontend-facing api (`BE/api`)
- `POST /v1/d2l/connect`
- `GET /v1/d2l/status`
- `POST /v1/d2l/disconnect`
- `POST /v1/sync/courses`
- `GET /v1/courses`
- `GET /v1/sync/logs` (optional helper)

### internal connector api (`BE/connector`)
- `POST /internal/login`
- `POST /internal/request`

All connector routes require:

`x-internal-secret: CONNECTOR_INTERNAL_SECRET`

## limitations in phase 1

- some schools use custom sso/duo flows that may block automated login
- selector overrides may be needed for custom login forms
- this phase syncs courses only (no assignment/content semantic map yet)

## troubleshooting

- login fails with custom sso/duo:
  - set `PLAYWRIGHT_HEADFUL=true`
  - set `PLAYWRIGHT_SLOWMO_MS=100`
  - set `PLAYWRIGHT_AUTH_WAIT_MS=180000`
  - provide `BS_USER_SELECTOR`, `BS_PASS_SELECTOR`, `BS_SUBMIT_SELECTOR`
- connector unavailable:
  - verify connector is running at `http://localhost:4002`
  - verify `CONNECTOR_INTERNAL_SECRET` matches in api and connector env files
- status shows expired:
  - reconnect from `/login`
- no courses after sync:
  - confirm D2L account has active enrollments and rerun sync

## security notes

- never persist passwords
- never log credentials
- never log raw storageState
- encrypt storageState at rest with `crypto-js` aes
