# Gap2Action — Backend Server

Node.js + Express + SQLite backend for the Gap2Action maturity assessment platform.

## Quick Start

Open a terminal in `gap2action/server/` and run:

```bash
# 1. Install dependencies (requires Node.js 18+)
npm install

# 2. Create the database and all tables
npm run migrate

# 3. Seed with mock data (users, events, templates, etc.)
npm run seed

# 4. Start the dev server (hot-reload)
npm run dev
```

Server will be available at: **http://localhost:3001/api**

Verify it's running: http://localhost:3001/api/health

---

## Demo Login Credentials

| Email | Password | Role |
|-------|----------|------|
| admin@nudj.com | password | Admin |
| assessor@nudj.com | password | Assessor |
| respondent@nudj.com | password | Respondent |

---

## Frontend Setup

In `gap2action/` (the frontend root), create or update `.env.local`:

```
VITE_API_URL=http://localhost:3001/api
```

Then restart the frontend dev server (`npm run dev` in the frontend folder).

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot-reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled production build |
| `npm run migrate` | Create all database tables |
| `npm run seed` | Populate database with mock data |
| `npm run setup` | Migrate + seed in one command |

---

## Project Structure

```
server/
├── src/
│   ├── index.ts              Express app entry (port 3001)
│   ├── db.ts                 SQLite connection (better-sqlite3)
│   ├── migrate.ts            Creates all 20 database tables
│   ├── seed.ts               Inserts mock data
│   ├── middleware/
│   │   ├── auth.ts           JWT verify middleware + requireRole helper
│   │   └── error.ts          Global error handler
│   └── routes/
│       ├── auth.ts           POST /auth/login|logout|refresh, GET /auth/me
│       ├── categories.ts     Full CRUD /categories
│       ├── frameworks.ts     Full CRUD /frameworks (with maturity levels)
│       ├── templates.ts      Full CRUD /templates + PUT /sections
│       ├── events.ts         Full CRUD /events + PATCH /respondents
│       ├── users.ts          CRUD /users + /groups + /departments
│       ├── submissions.ts    GET/PUT/POST /submissions + validate/return
│       ├── evidence.ts       POST /evidence/upload, DELETE /evidence/:id
│       ├── recommendations.ts GET/generate/chat/PATCH /recommendations
│       └── tasks.ts          Full CRUD /tasks + dependencies
├── data/
│   └── gap2action.db         SQLite database file (created on first run)
├── uploads/                  Evidence file storage (local in dev)
├── .env                      Environment variables
├── package.json
└── tsconfig.json
```

---

## Auth Flow

- Login → sets `access_token` (15m) + `refresh_token` (7d) as httpOnly cookies
- All protected routes verify the `access_token` cookie via JWT
- On 401, the frontend auto-calls `/auth/refresh` to get a new access token
- Logout clears both cookies

---

## Evidence Files

In dev mode, files upload to `server/uploads/` and are served at `http://localhost:3001/uploads/<filename>`.
In production, replace `evidence.ts` with Azure Blob Storage upload logic.
