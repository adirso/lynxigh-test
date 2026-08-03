# Tech Stack & Design Decisions

This document explains what was chosen for Reloop and why, including the
alternatives considered. It's meant to make the reasoning behind the stack
legible to a reviewer, not just the stack itself.

## Monorepo: pnpm workspaces

A single repo with `apps/backend` and `apps/frontend` as pnpm workspace
members.

**Alternatives considered:** npm/yarn workspaces (equivalent for a project
this size, pnpm preferred for its stricter dependency isolation and faster
installs), Turborepo (adds task-caching/pipelines on top of workspaces —
real value shows up with more packages and CI-caching needs than two apps
have here).

For two apps with no shared internal packages, a build-orchestration tool
would be overhead without payoff.

## Backend: Node.js + Express + TypeScript

**Alternatives considered:** Fastify (faster, built-in schema validation —
a reasonable alternative, just less ubiquitous), NestJS (opinionated,
structured, DI-based — the right choice for a larger team/app, but adds
ceremony a single-resource REST API this size doesn't need).

Express's minimalism and ecosystem size made it the fastest path to a clean,
well-understood API for the scope here: auth, categories, items, moderation
— five route groups, no deep module graph that would benefit from NestJS's
structure.

## Database: PostgreSQL

**Alternative considered:** MySQL — an equally valid choice for this
project's size; this came down to fit rather than one being objectively
better.

Postgres won on three points specific to this schema:
- **JSONB/array support** — the listing-options multi-select (`Delivery
  available`, `Local pickup`, etc.) is stored as a `text[]` column with a
  GIN index, rather than a join table. A join table would multiply row
  count for a small, fixed option set with no benefit (evaluated against a
  hypothetical billion-item catalog during design — see the schema
  rationale in `apps/backend/prisma/schema.prisma`).
- **Full-text search** built in (`tsvector`/`pg_trgm`), relevant to the
  catalog search feature without needing a separate search service.
- **Enum types** for `Role` and `ItemStatus`, enforced at the DB level.

## ORM: Prisma

**Alternatives considered:** Drizzle (lighter-weight, more SQL-like, full
type inference — a strong alternative), raw SQL with a thin query builder
like Kysely (maximum control, most boilerplate).

Prisma's generated client, built-in migration workflow, and low boilerplate
were the best fit for a schema of this size (5 models) built and iterated
on quickly across many small tasks.

## Auth: JWT (stateless), not server-side sessions

Access tokens signed by the backend, no sessions table, no server-side
session store.

**Alternative considered:** server-side sessions (easier instant
revocation, but adds a session store as infrastructure for a small app).

Given the app's scale and that nothing here requires instant token
revocation, JWT is the simpler thing to build, test, and deploy.

**One deliberate restriction, added after a security review:** public
registration (`POST /auth/register`) can only ever create `CONTRIBUTOR`
accounts — `role` is not a client-supplied field. Moderator accounts are
provisioned only via the seed script. The initial design allowed a
client to self-register as either role, which meant anyone could mint a
moderator token and bypass every other access control in the app; this was
caught in a whole-branch security review and closed before the backend
was merged.

## Data modeling choices worth calling out

- **`condition`** is a plain validated string, not a DB enum or lookup
  table — the five values (`New`, `Like new`, ...) are fixed and unlikely
  to need runtime management, so a lookup table would be pure overhead.
- **`categories`** IS a DB table (not an enum) — categories are more likely
  to be renamed/added over the product's life than conditions are, so this
  one gets the flexibility of a real table.
- **`item_photos`** is a separate table, not an array column — photos are
  user-uploaded, variable-count, need ordering and a "primary photo" flag,
  and may carry per-photo metadata later.
- **`status_events`** is an append-only audit log of every status
  transition (`pending → published`, `pending → rejected`, etc.) — kept
  separate from the item's current state so the full moderation history
  survives even after the item itself changes.

## Photo storage: pluggable `StoragePort`, not hardcoded to disk or S3

A small interface (`save`/`delete`) with a `LocalDiskStorage` driver for
local development and an `S3Storage` driver planned for the deployment
plan, selected at startup via an env var. This means the app runs entirely
locally with zero AWS credentials, but the production deployment (a
separate, later plan) only needs to add the S3 implementation — nothing
in the item-creation code path needs to change.

## Frontend: Vite + React + TypeScript

**Alternative considered:** Next.js — its SSR/SSG and file-based routing
are real capabilities, but they overlap with the standalone Express
backend this assignment calls for. There's no SEO or first-paint
requirement here (a small catalog with public browsing plus two
authenticated roles), so a client-side Vite SPA is the simpler, more
direct fit — no need to run two backends or reduce Next.js to just a
frontend shell.

## Frontend data layer: React Router + TanStack Query

React Router handles the ~9 routes (catalog, detail, login/signup,
create/edit listing, my-listings, moderation). TanStack Query replaces
manual `useEffect`-based fetching with caching, automatic refetch-on-
mutation, and built-in loading/error states — this matters for a catalog
UI with a lot of cross-page invalidation (e.g., approving an item in the
moderation queue needs the public catalog's cache to reflect it).

## Styling: plain global CSS, not Tailwind or a component library

**Why not Tailwind/CSS Modules/a component library:** the visual design
was produced as a mockup (via Claude Design) with its own small design
system — CSS custom properties for tokens (color, spacing, radius,
shadows) plus semantic component classes (`.btn`, `.card`, `.tag`, `.input`,
etc.). That system was ported directly into the app as global CSS, trimmed
of an unused decorative print-effect (a CMYK/halftone treatment the mockup
shipped but never used on any actual screen). Using it as-is — rather than
re-expressing it as Tailwind utilities or a component library's API — kept
the implementation a direct, verifiable match to the approved design with
no re-authoring risk.

## Testing

- **Backend:** Vitest + Supertest against a real local Postgres — no
  database mocking. Tests exercise the actual Prisma queries, auth
  middleware, and HTTP layer together.
- **Frontend:** Vitest + React Testing Library + MSW (Mock Service Worker).
  MSW intercepts the frontend's real `fetch` calls at the network layer, so
  component tests exercise the actual API client code without needing the
  backend running.

## Deployment (planned, not yet built)

Docker Compose on a single EC2 instance, AWS RDS for managed Postgres, S3
for photo storage in production.

**Alternative considered:** ECS — more AWS-native and "production-shaped,"
but adds infrastructure (task definitions, service, load balancer,
networking) that isn't worth the complexity at this project's scale. A
single EC2 instance running Compose is the simplest thing that satisfies
the assignment's deployment requirement.
