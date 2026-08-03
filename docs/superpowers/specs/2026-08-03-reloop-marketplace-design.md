# Reloop Marketplace Catalog — Design

## Overview

A marketplace catalog web app (per the Lynxight Senior Dev Assignment): the public
browses published listings with no account, contributors submit listings that enter
a moderation queue, and moderators approve/reject/edit/delete anything in the
catalog. Two required AI touches: drafting a title/description from uploaded photos
at creation time, and flagging prohibited/low-quality submissions for the moderator.

Product/visual reference: a 5-screen mockup ("Reloop") built in Claude Design,
imported and adapted for this spec (see Screens section).

## Data Model

Relational schema, PostgreSQL.

### `users`
| column | type | notes |
|---|---|---|
| id | PK | |
| email | unique | |
| password_hash | | |
| name | | display name |
| role | text | `contributor` \| `moderator` — a user has exactly one role |
| created_at | timestamp | |

### `categories`
| column | type | notes |
|---|---|---|
| id | PK | |
| name | unique | Electronics, Furniture, Clothing, Vehicles, Home & Garden, Sports & Outdoors, Toys & Games, Other |

Normalized into its own table (rather than an enum) so categories can be
added/renamed without a schema migration.

### `items`
| column | type | notes |
|---|---|---|
| id | PK | |
| title | text | |
| description | text | |
| price | numeric | |
| condition | text | New \| Like new \| Good \| Fair \| For parts — validated in application code, not a DB constraint |
| is_negotiable | boolean | |
| min_price | numeric, nullable | only meaningful when `is_negotiable` |
| category_id | FK → categories | |
| options | text[] | multi-select: Delivery available, Local pickup, Open to trades, Original packaging, Warranty included, Bundle deal. Validated in code; GIN index for containment queries. Chosen over a join table because the option set is small and fixed — a join table would multiply row count for no benefit at scale (evaluated against a hypothetical 1B-item catalog) |
| contributor_id | FK → users | who created it |
| status | text | `pending` \| `published` \| `rejected` \| `cancelled` |
| reviewed_by | FK → users, nullable | moderator who last acted |
| reviewed_at | timestamp, nullable | |
| rejection_reason | text, nullable | |
| ai_flagged | boolean | set by the moderation-screening AI pass |
| ai_flag_reason | text, nullable | |
| ai_confidence | numeric, nullable | |
| created_at | timestamp | |
| updated_at | timestamp | |

Status lifecycle: `pending` → `published` / `rejected` (moderator-driven);
`pending` or `published` → `cancelled` (contributor withdraws their own listing).

AI-drafted title/description suggestions are **not persisted** — the suggestion
endpoint returns them to the frontend for the contributor to accept/edit, and only
the final submitted values are stored on the item.

### `item_photos`
| column | type | notes |
|---|---|---|
| id | PK | |
| item_id | FK → items | |
| url | text | opaque — resolves via whichever storage driver is active |
| position | int | display order |
| is_primary | boolean | shown on catalog cards |
| created_at | timestamp | |

A separate table (not an array column) because photos are user-uploaded,
variable-count, need ordering/primary selection, and may carry per-photo metadata
later.

### `status_events` (audit log)
| column | type | notes |
|---|---|---|
| id | PK | |
| item_id | FK → items | |
| actor_id | FK → users, nullable | null for system/AI-triggered transitions |
| from_status | text | |
| to_status | text | |
| reason | text, nullable | |
| created_at | timestamp | |

Append-only record of every status transition, for moderator/contributor history.

### Relationships
- `users` 1—N `items` (as contributor, and separately as `reviewed_by`)
- `categories` 1—N `items`
- `items` 1—N `item_photos`
- `items` 1—N `status_events`

## Architecture

**Monorepo**: pnpm workspaces, `apps/frontend` + `apps/backend`.

**Backend**: Node.js + Express + TypeScript. Prisma as the ORM against PostgreSQL.
RESTful API for users, items, and moderation actions.

**Auth**: JWT (stateless access tokens). `users.password_hash` for credential
storage. No sessions table. Role (`contributor` \| `moderator`) is fixed on the
account — no role picker at login.

**Frontend**: Vite + React + TypeScript. React Router for routes. TanStack Query
for server state (caching, refetch-on-mutation, loading/error states).

**Styling**: the Broadsheet design system CSS imported from the Reloop mockup —
CSS custom properties (color/spacing/radius/shadow tokens, serif headings) plus
plain semantic component classes (`.btn`, `.input`, `.field`, `.card`, `.tag`,
`.seg`, `.table`, `.dialog`, `.nav`), used directly as global CSS with no build
step. The mockup's decorative CMYK/halftone print-separation effect and its
pointer-tracking SVG-filter driver (`print-plates.js`) are **not** ported — no
screen in the actual design uses them, so including them would ship unused
complexity.

**Photo storage**: an abstracted `StoragePort` interface (`save(file) → url`,
`delete(url)`) with two implementations:
- `LocalDiskStorage` — writes to a container volume, for running the whole stack
  locally without AWS credentials.
- `S3Storage` — for the deployed environment.

Selected at startup via an env var (`STORAGE_DRIVER=local|s3`). `item_photos.url`
is opaque to callers either way.

**AI**: OpenAI GPT-4o (vision), one provider for both features:
1. **Draft-from-photos** — on the create/edit form, given the uploaded photos (and
   any partially-filled fields), returns a suggested title and description. Purely
   ephemeral — the contributor edits/accepts before submit; nothing AI-specific is
   stored.
2. **Moderation screening** — runs automatically when a listing enters `pending`;
   flags possible prohibited-item or low-quality submissions and writes
   `ai_flagged` / `ai_flag_reason` / `ai_confidence` onto the item as a hint for
   the moderator queue. The moderator still makes the final call.

**Containerization & deployment**: whole project runs via Docker Compose
(frontend, backend, local Postgres for dev). Production deployment: Docker
Compose on a single EC2 instance; AWS RDS for managed PostgreSQL; S3 for photo
storage (`STORAGE_DRIVER=s3`).

## Screens / Routes

Adapted from the 5-screen Reloop mockup:

| Route | Screen | Notes |
|---|---|---|
| `/login` | Sign in | Single form; role comes from the account, no picker |
| `/` | Public catalog | Search + category/condition filters; card grid (title, primary photo, price, condition, category); public, no auth |
| `/items/:id` | Item detail | All photos, full description, price + negotiability, condition, category, options |
| `/listings/new`, `/items/:id/edit` | Create / edit listing | Shared form (contributor creates, moderator edits any item); AI draft callout on title/description with Regenerate |
| `/moderation` | Moderator dashboard | Stat cards (pending / published / rejected-30d / avg review time), Pending / All / Rejected tabs, queue table with approve/reject/edit/delete row actions |

## Out of Scope (for this pass)

- Purchasing/payments (explicitly excluded by the assignment — catalog, not a store)
- Multi-role users (a user is a contributor *or* a moderator, not both)
- Session-based auth / instant token revocation
- Persisted AI-suggestion history or analytics on suggestion acceptance
