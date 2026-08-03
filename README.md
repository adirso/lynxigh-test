# Reloop — Marketplace Catalog

A marketplace catalog web app: contributors submit item listings, moderators
curate what gets published, and anyone can browse the public catalog without
an account.

## Tech Stack

- **Backend:** Node.js, Express, TypeScript, Prisma, PostgreSQL
- **Frontend:** React, TypeScript, Vite, React Router, TanStack Query
- **Auth:** JWT (stateless)
- **Monorepo:** pnpm workspaces (`apps/backend`, `apps/frontend`)

## Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io) 9+
- Docker (for the local Postgres instance)

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
  frontend/
    src/
      api/            # TanStack Query hooks per backend resource
      auth/            # auth context, route guards
      components/      # shared UI (item form, photo picker, nav layout)
      pages/           # one file per route
      styles/         # global design-system CSS
    test/             # Vitest + React Testing Library + MSW
docker-compose.yml    # local Postgres
```

## Roadmap

This covers the core backend + frontend. Not yet built:

- AI-assisted features (e.g. drafting listing descriptions from photos,
  moderation screening)
- Dockerized deployment to AWS
