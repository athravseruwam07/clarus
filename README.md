# Clarus

Clarus is an AI-powered academic copilot for D2L/Brightspace that helps students cut through LMS friction and understand exactly what to do next.

Instead of forcing students to dig through course shells, modules, announcements, Dropbox folders, quizzes, and calendar items, Clarus aims to turn Brightspace into a clearer command center for priorities, planning, and execution.

## 🏁 Project Background

Clarus began at **CTRL+HACK+DEL 2.0** at **York University**.

The initial hackathon team was:
- **Athrav Seruwam**: frontend/dashboard experience, onboarding and calendar-oriented product flows, AI chat/demo-facing UI, and the hackathon demo video
- **Matthew Kim**: backend/product integration, auth and account flow improvements, login/landing experience, planning logic, and post-hackathon product polish
- **Ali Husseini**: weekly workload features, account/settings work, sidebar/UI updates, optimizer refinements, and cross-platform/dev-environment support

Since the hackathon, the project has continued to evolve into a more structured full-stack system with a stronger dashboard, planning workflows, sync logic, and student-facing usability improvements.

## ✨ What Clarus Does

Clarus is not just a planner. It is meant to function as an **AI academic control layer** on top of D2L/Brightspace by helping students:

- sync their LMS into one workspace
- identify upcoming assignments, quizzes, exams, and events
- surface the highest-leverage next task
- break work into actionable steps
- understand heavier weeks before they arrive
- generate study plans and workload views
- navigate to the exact course content they need

## 🧠 Core Vision

The long-term goal is an academic navigation engine that connects:

`modules -> topics -> resources -> assignment actions`

So instead of students asking:

> “Where do I even start?”

Clarus can eventually answer with something closer to:

> “Review module 3, lecture 3.2 slides, chapter 6, and practice set 3 question 4 before starting this assignment.”

## 🚀 Phase 1 MVP

The current MVP focuses on the hackathon-to-MVP foundation:

- connect to D2L/Brightspace
- retrieve real enrolled course data through D2L APIs
- sync course and timeline information into a student dashboard
- support secure session-based access through a Playwright-powered connector
- keep the architecture extensible for future planning, AI guidance, and semantic navigation features

## 🛠 Tech Stack

### Frontend
- Next.js
- React
- TypeScript
- Tailwind CSS

### Backend
- Node.js
- Fastify
- TypeScript
- Zod

### Data / Infra
- PostgreSQL
- Prisma
- Docker Compose

### Automation / Integration
- Playwright

## 🔐 Auth Strategy

Clarus uses a hackathon-friendly Brightspace connector flow:

`Playwright login -> capture storageState -> D2L /d2l/api JSON`

Two modes are supported:
- **Manual login (default)**: users pick their university and sign in through a popup/browser flow. Clarus does not receive or store their password.
- **Credentials mode (optional)**: the API can forward username/password once for environments without SSO/2FA.

Important constraints:
- no browser extension
- no HTML scraping for course data
- passwords are never persisted
- credentials only exist in memory during login attempts
- only encrypted Playwright `storageState` is stored in Postgres
- connector endpoints are protected by an internal shared secret

## 📁 Repo Structure

```text
Clarus/
├── FE/
├── BE/
│   ├── api/
│   ├── connector/
│   └── docker-compose.yml
├── docs/
└── README.md
```

## ⚙️ Environment

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
PLAYWRIGHT_HEADFUL=true
PLAYWRIGHT_SLOWMO_MS=75
PLAYWRIGHT_AUTH_WAIT_MS=180000
PLAYWRIGHT_LOGIN_UI=popup
PLAYWRIGHT_CLOSE_ON_SUCCESS=true
PLAYWRIGHT_REUSE_LOGIN_WINDOW=false

BS_USER_SELECTOR=input[name="username"]
BS_PASS_SELECTOR=input[name="password"]
BS_SUBMIT_SELECTOR=button[type="submit"]
```

### `FE/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:4001
NEXT_PUBLIC_DEFAULT_INSTANCE_URL=https://yourschool.brightspace.com
```

Important local auth note:
- if FE runs on `http://localhost:3000`, set `NEXT_PUBLIC_API_URL=http://localhost:4001`
- if FE runs on `http://127.0.0.1:3000`, set `NEXT_PUBLIC_API_URL=http://127.0.0.1:4001`

Keep the hostname consistent between frontend and API so cookies behave correctly.

## ▶️ Run Instructions

### Easiest path

From the repo root:

```bash
npm run setup
npm run dev
```

This starts:
- Postgres (Docker)
- connector on `:4002`
- API on `:4001`
- frontend on `:3000`

To stop app services, press `Ctrl + C` in the terminal running `npm run dev`.

To stop Postgres:

```bash
npm run db:down
```

### Manual path

1. Start Postgres

```bash
cd BE
docker compose up -d
```

2. Start connector

```bash
cd BE/connector
npm install
npm run dev
```

3. Start API

```bash
cd BE/api
npm install
npx prisma db push
npm run dev
```

4. Start frontend

```bash
cd FE
npm install
npm run dev
```

Visit:

`http://localhost:3000`

## 🔌 API Endpoints

### Public frontend-facing API (`BE/api`)
- `POST /v1/d2l/connect`
- `GET /v1/d2l/status`
- `POST /v1/d2l/disconnect`
- `POST /v1/sync/courses`
- `GET /v1/courses`
- `GET /v1/sync/logs`

### Internal connector API (`BE/connector`)
- `POST /internal/login`
- `POST /internal/login/manual`
- `POST /internal/request`

All connector routes require:

`x-internal-secret: CONNECTOR_INTERNAL_SECRET`

## 🧩 Feature Scaffolding

The repo includes parallel workstream scaffolds so multiple team members can build at the same time:

- frontend workspaces under `FE/app/dashboard/(member-*)/*`
- backend workstreams under `BE/api/src/routes/workstreams/*`
- demo flow endpoints under `BE/api/src/routes/demo.flow.ts`
- planning docs in `docs/workstreams.md`
- owner/route/API mapping in `docs/feature-matrix.md`

## ⚠️ Current Limitations

- some schools use custom SSO/Duo flows that may block automated login
- selector overrides may be needed for custom login forms
- this phase is still primarily a course/timeline foundation, not the full semantic academic navigation engine

## 🧪 Troubleshooting

- **Login fails with custom SSO/Duo**
  - set `PLAYWRIGHT_HEADFUL=true`
  - set `PLAYWRIGHT_SLOWMO_MS=100`
  - set `PLAYWRIGHT_AUTH_WAIT_MS=180000`
  - provide `BS_USER_SELECTOR`, `BS_PASS_SELECTOR`, `BS_SUBMIT_SELECTOR`

- **Login opens a separate browser window and you want a new tab in Chrome**
  - start a dedicated Chrome instance with remote debugging:

  ```bash
  npm run chrome:debug
  ```

  - optional override:

  ```bash
  CLARUS_CHROME_BIN=/path/to/chrome npm run chrome:debug
  ```

- **Connector unavailable**
  - verify connector is running at `http://localhost:4002`
  - verify `CONNECTOR_INTERNAL_SECRET` matches in API and connector env files

- **Login redirects back to `/login` after success**
  - ensure FE and API use the same host label
  - mixed hostnames like `localhost` vs `127.0.0.1` can break cookies

- **Status shows expired**
  - reconnect from `/login`

- **No courses after sync**
  - confirm the D2L account has active enrollments
  - rerun course sync

## 🛡 Security Notes

- never persist passwords
- never log credentials
- never log raw Playwright `storageState`
- encrypt session state at rest

## 👩‍💻 Team

Built initially at **CTRL+HACK+DEL 2.0 @ York University** by:

- **Athrav Seruwam** — dashboard/frontend systems, onboarding and calendar flows, AI chat/demo UX, and the hackathon demo video
- **Matthew Kim** — integration-heavy product development, login/auth polish, planning logic, dashboard usability improvements, and backend-connected student workflows
- **Ali Husseini** — workload and optimizer features, account/settings flows, sidebar/UI improvements, and local development compatibility work

## 🙌 Acknowledgements

Thanks to the organizers of **CTRL+HACK+DEL 2.0** at **York University** for creating the space to build the first version of Clarus.

Clarus started as a hackathon build, but it has grown into a much more serious exploration of how AI can reduce academic friction in real student workflows.
