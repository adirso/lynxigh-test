# Reloop — Marketplace Catalog

A marketplace catalog web app: contributors submit item listings, moderators
curate what gets published, and anyone can browse the public catalog without
an account.

## Tech Stack

- **Backend:** Node.js, Express, TypeScript, Prisma, PostgreSQL
- **Frontend:** React, TypeScript, Vite, React Router, TanStack Query
- **Auth:** JWT (stateless)
- **Monorepo:** pnpm workspaces (`apps/backend`, `apps/frontend`)

See [TECH_STACK.md](./TECH_STACK.md) for the reasoning behind these choices
and the alternatives considered.

## Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io) 9+
- Docker

## Running everything with Docker (recommended for just trying it out)

The whole stack — Postgres, backend, frontend — runs via Docker Compose,
with persistent data across restarts.

```bash
pnpm docker:up          # builds images and starts postgres + backend + frontend
pnpm docker:seed        # categories + demo moderator accounts (safe to re-run)
```

- Frontend: **http://localhost:5173**
- Backend: **http://localhost:4000**
- Postgres: `localhost:5433` (mapped from the container's `5432`)

Demo moderator login:

| Email | Password |
|---|---|
| `moderator@reloop.dev` | `moderator-demo-pw-1` |
| `moderator2@reloop.dev` | `moderator-demo-pw-1` |

Other commands:

```bash
pnpm docker:down          # stop and remove containers — data persists (named volumes)
pnpm docker:restart       # down + up, no reseed — same data as before
pnpm docker:restart:seed  # down + up, then reseed (categories/moderators; safe — never touches items/users you created)
pnpm docker:logs          # follow logs from all three services
```

**Data persistence:** Postgres data and uploaded photos live in named Docker
volumes (`postgres_data`, `backend_uploads`), not in the containers
themselves — killing, stopping, or recreating containers (`docker:down`,
`docker:restart`, a crash, `docker compose down`) never loses data. The only
way to actually wipe it is `docker compose down -v` (removes the volumes
too) or `docker volume rm`.

**Rebuilding after code changes:** this setup copies source into the image
at build time rather than bind-mounting it (simpler, no dev/prod drift), so
there's no hot-reload — after changing backend/frontend code, run
`pnpm docker:up` again (it rebuilds automatically, `docker compose` only
rebuilds layers that changed). For active development with hot-reload, run
the backend/frontend directly on the host instead (see below) — that's the
faster edit loop; the Docker setup is meant for "run the whole thing
cleanly" rather than day-to-day iteration.

## Running locally without Docker (faster edit loop, hot-reload)

## 1. Install dependencies

From the repo root:

```bash
pnpm install
```

## 2. Start Postgres

```bash
docker compose up -d postgres
```

This maps Postgres to **host port 5433** (not the default 5432) to avoid
clashing with other Postgres instances that might already be running on your
machine.

## 3. Configure environment variables

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
```

The defaults in both `.env.example` files work out of the box with the
Docker Compose setup above — no edits needed for local development.

| Variable (backend) | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | API server port |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5433/reloop` | Postgres connection string |
| `JWT_SECRET` | `dev-secret-change-me` | JWT signing secret — change for anything beyond local dev |
| `JWT_EXPIRES_IN` | `1d` | Access token lifetime |
| `STORAGE_DRIVER` | `local` | Photo storage backend (`local` disk for dev; an `s3` driver is planned) |
| `UPLOADS_DIR` | `./uploads` | Where uploaded photos are written when `STORAGE_DRIVER=local` |

| Variable (frontend) | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | `http://localhost:4000` | Backend API base URL |

## 4. Set up the database

```bash
cd apps/backend
npx prisma generate
npx prisma migrate deploy
pnpm prisma:seed
```

The seed script creates the 8 fixed categories (Electronics, Furniture,
Clothing, Vehicles, Home & Garden, Sports & Outdoors, Toys & Games, Other)
and two demo moderator accounts for local testing:

| Email | Password |
|---|---|
| `moderator@reloop.dev` | `moderator-demo-pw-1` |
| `moderator2@reloop.dev` | `moderator-demo-pw-1` |

These demo accounts are only seeded when `NODE_ENV` is not `production` — do
not reuse these credentials outside local development.

There's no seeded contributor account — sign up for one through the app
(public registration always creates a `CONTRIBUTOR` account).

## 5. Run the backend

```bash
cd apps/backend
pnpm dev
```

API listens on `http://localhost:4000`.

## 6. Run the frontend

In a separate terminal:

```bash
cd apps/frontend
pnpm dev
```

Vite prints the local URL (typically `http://localhost:5173`).

## 7. Try it out

- Browse the public catalog — no account needed.
- Sign up as a contributor, create a listing (with at least one photo) — it
  enters moderation as `pending`.
- Log in as a demo moderator to see the moderation queue and
  approve/reject/edit/delete listings.

## Viewing the database

**Prisma Studio** (browser GUI, easiest option):

```bash
cd apps/backend
npx prisma studio
```

Opens at `http://localhost:5555` with a browsable/editable view of every
table.

**psql**, connecting to the Dockerized Postgres directly:

```bash
docker exec -it lynxigh-postgres-1 psql -U postgres -d reloop
```
(container name depends on how you started Postgres — `docker compose ps` shows the actual name if this doesn't match.)

**Any GUI client** (TablePlus, DBeaver, Postico, etc.) — connect with:
- Host: `localhost`
- Port: `5433`
- User / Password: `postgres` / `postgres`
- Database: `reloop`

> Running the backend test suite (`pnpm test`) resets the `users`/`items`
> tables against whatever database `DATABASE_URL` points at — dev and tests
> share one local Postgres instance. If your data disappears after running
> tests, re-run `pnpm prisma:seed` to restore the categories and demo
> moderator accounts.

## Running tests

**Backend** (from `apps/backend`, requires Postgres running):

```bash
pnpm test
```

**Frontend** (from `apps/frontend`, no backend required — API calls are
mocked):

```bash
pnpm test
```

## Building for production

```bash
cd apps/backend && pnpm build   # compiles to dist/
cd apps/frontend && pnpm build  # outputs to dist/
```

## Project structure

```
apps/
  backend/
    prisma/          # schema, migrations, seed script
    src/
      auth/           # JWT, password hashing, register/login
      categories/      # category listing
      items/          # listing CRUD, create/list/detail/cancel/edit/delete
      moderation/      # moderation queue, approve/reject
      middleware/      # auth guards, error handling
      storage/        # photo storage abstraction (local disk; S3 planned)
    test/             # Vitest + Supertest integration tests
    Dockerfile        # builds, generates the Prisma client, migrates on start
  frontend/
    src/
      api/            # TanStack Query hooks per backend resource
      auth/            # auth context, route guards
      components/      # shared UI (item form, photo picker, nav layout)
      pages/           # one file per route
      styles/         # global design-system CSS
    test/             # Vitest + React Testing Library + MSW
    Dockerfile        # multi-stage build -> static assets served via `serve`
docker-compose.yml    # postgres + backend + frontend, all three
```

## Roadmap

This covers the core backend + frontend, and running the full stack locally
via Docker. Not yet built:

- AI-assisted features (e.g. drafting listing descriptions from photos,
  moderation screening)
- Deployment to AWS (the Docker images this repo builds are the starting
  point — this is about running them on EC2/ECS with RDS + S3, not building
  them)
