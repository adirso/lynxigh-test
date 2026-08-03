# Backend & Data Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Reloop marketplace REST API — auth, categories, items (create/list/detail/cancel/edit/delete), moderation (queue/approve/reject), and a swappable photo-storage abstraction — backed by PostgreSQL via Prisma, fully covered by tests, runnable locally with one Postgres container.

**Architecture:** Express + TypeScript backend in `apps/backend` (pnpm workspace). Layered per module (`routes` → `service` → Prisma), Prisma models map 1:1 to the spec's data model. JWT auth with `requireAuth`/`requireRole` middleware. A `StoragePort` interface decouples item-photo persistence from disk vs S3 (only the local-disk driver ships in this plan; S3 is added in the deployment plan). Tests use Vitest + Supertest against a real local Postgres, resetting relevant tables between test files.

**Tech Stack:** Node.js, TypeScript, Express, Prisma, PostgreSQL, Vitest, Supertest, Zod, bcryptjs, jsonwebtoken, multer, pnpm workspaces, Docker Compose (Postgres only — app containers come in the deployment plan).

## Global Constraints

- Monorepo: pnpm workspaces, this plan only creates `apps/backend` (the design spec also calls for `apps/frontend`, added by a later plan).
- Condition values are validated in application code, not a DB enum: `New`, `Like new`, `Good`, `Fair`, `For parts`.
- Listing options are validated in application code, not a DB enum: `Delivery available`, `Local pickup`, `Open to trades`, `Original packaging`, `Warranty included`, `Bundle deal`.
- Categories are a DB table (not an enum), seeded with exactly: Electronics, Furniture, Clothing, Vehicles, Home & Garden, Sports & Outdoors, Toys & Games, Other.
- A user has exactly one role: `CONTRIBUTOR` or `MODERATOR`.
- Item status lifecycle: `PENDING` → `PUBLISHED` / `REJECTED` (moderator-driven); `PENDING` or `PUBLISHED` → `CANCELLED` (contributor withdraws their own listing). Every transition writes a `StatusEvent` row.
- AI-drafted suggestions are never persisted on the item — out of scope for this plan (covered by the AI features plan).
- Auth is JWT-based, stateless — no sessions table.

---

## File Structure

```
pnpm-workspace.yaml
package.json                        # root workspace manifest
docker-compose.yml                  # Postgres only, for local dev + tests

apps/backend/
  package.json
  tsconfig.json
  vitest.config.ts
  .env.example
  prisma/
    schema.prisma
    seed.ts
  src/
    env.ts                          # validated process.env
    db.ts                           # Prisma client singleton
    errors.ts                       # AppError + subclasses
    app.ts                          # Express app assembly
    server.ts                       # listens on PORT
    middleware/
      error-handler.ts
      auth.ts                       # requireAuth, requireRole, attachUserIfPresent
    auth/
      password.ts
      jwt.ts
      auth.service.ts
      auth.routes.ts
    categories/
      categories.service.ts
      categories.routes.ts
    storage/
      storage-port.ts                # interface + createStorage() factory
      local-disk-storage.ts
    items/
      items.constants.ts             # CONDITIONS, LISTING_OPTIONS
      items.schemas.ts               # zod schemas + inferred types
      items.serialize.ts             # DB row -> JSON-safe shape
      items.service.ts
      items.routes.ts
    moderation/
      moderation.service.ts
      moderation.routes.ts
  test/
    helpers/
      build-app.ts
      db-reset.ts
      factories.ts                   # createTestUser, authHeader
    health.test.ts
    error-handler.test.ts
    storage/local-disk-storage.test.ts
    auth/password.test.ts
    auth/jwt.test.ts
    auth/auth.routes.test.ts
    middleware/auth.test.ts
    categories/categories.routes.test.ts
    items/items.create.test.ts
    items/items.read.test.ts
    items/items.cancel.test.ts
    items/items.moderator-edit-delete.test.ts
    moderation/moderation.test.ts
```

---

### Task 1: Monorepo scaffold + health check

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json`
- Create: `apps/backend/package.json`
- Create: `apps/backend/tsconfig.json`
- Create: `apps/backend/vitest.config.ts`
- Create: `apps/backend/.env.example`
- Create: `apps/backend/src/env.ts`
- Create: `apps/backend/src/app.ts`
- Create: `apps/backend/src/server.ts`
- Create: `docker-compose.yml`
- Test: `apps/backend/test/health.test.ts`

**Interfaces:**
- Produces: `createApp(): express.Express` (from `src/app.ts`) — every later routes test imports this to build a Supertest instance. `loadEnv(): Env` (from `src/env.ts`) with shape `{ port: number; databaseUrl: string; jwtSecret: string; jwtExpiresIn: string; storageDriver: 'local' | 's3'; uploadsDir: string }`.

- [ ] **Step 1: Create the workspace and backend package files**

`pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
```

`package.json` (root):
```json
{
  "name": "reloop-marketplace",
  "private": true,
  "packageManager": "pnpm@9.0.0"
}
```

`apps/backend/package.json`:
```json
{
  "name": "@reloop/backend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "test": "vitest run",
    "prisma:migrate": "prisma migrate dev",
    "prisma:generate": "prisma generate",
    "prisma:seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@prisma/client": "^5.20.0",
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "express": "^4.21.0",
    "jsonwebtoken": "^9.0.2",
    "multer": "^1.4.5-lts.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/multer": "^1.4.12",
    "@types/node": "^20.16.0",
    "@types/supertest": "^6.0.2",
    "prisma": "^5.20.0",
    "supertest": "^7.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.2",
    "vitest": "^2.1.1"
  }
}
```

`apps/backend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

`apps/backend/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
```

`apps/backend/.env.example`:
```
PORT=4000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/reloop
JWT_SECRET=dev-secret-change-me
JWT_EXPIRES_IN=1d
STORAGE_DRIVER=local
UPLOADS_DIR=./uploads
```

Copy `.env.example` to `.env` in `apps/backend` — this is what `env.ts` reads locally.

`docker-compose.yml` (repo root):
```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: reloop
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

Note: dev and tests share this one database. Test files truncate the tables they touch before running (see `test/helpers/db-reset.ts` in Task 3) — acceptable for local development, not meant for a shared environment.

- [ ] **Step 2: Write `src/env.ts`**

```typescript
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_EXPIRES_IN: z.string().default('1d'),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  UPLOADS_DIR: z.string().default('./uploads'),
});

export type Env = {
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  storageDriver: 'local' | 's3';
  uploadsDir: string;
};

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.parse(source);
  return {
    port: parsed.PORT,
    databaseUrl: parsed.DATABASE_URL,
    jwtSecret: parsed.JWT_SECRET,
    jwtExpiresIn: parsed.JWT_EXPIRES_IN,
    storageDriver: parsed.STORAGE_DRIVER,
    uploadsDir: parsed.UPLOADS_DIR,
  };
}
```

- [ ] **Step 3: Write the failing health check test**

`apps/backend/test/health.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('GET /health', () => {
  it('returns ok status', async () => {
    const app = createApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd apps/backend && pnpm test -- health.test.ts`
Expected: FAIL — `../src/app.js` does not exist.

- [ ] **Step 5: Write `src/app.ts` and `src/server.ts`**

`apps/backend/src/app.ts`:
```typescript
import express from 'express';
import cors from 'cors';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}
```

`apps/backend/src/server.ts`:
```typescript
import { createApp } from './app.js';
import { loadEnv } from './env.js';

const env = loadEnv();
const app = createApp();

app.listen(env.port, () => {
  console.log(`Reloop backend listening on port ${env.port}`);
});
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/backend && pnpm test -- health.test.ts`
Expected: PASS

- [ ] **Step 7: Install dependencies and commit**

```bash
docker compose up -d postgres
cd apps/backend && pnpm install
cd ../.. && git add pnpm-workspace.yaml package.json docker-compose.yml apps/backend
git commit -m "feat: scaffold backend workspace with health check"
```

---

### Task 2: Error handling foundation

**Files:**
- Create: `apps/backend/src/errors.ts`
- Create: `apps/backend/src/middleware/error-handler.ts`
- Modify: `apps/backend/src/app.ts`
- Test: `apps/backend/test/error-handler.test.ts`

**Interfaces:**
- Consumes: `createApp()` from Task 1.
- Produces: `AppError`, `NotFoundError`, `ForbiddenError`, `UnauthorizedError`, `ConflictError`, `ValidationError` (all extend `AppError` with `statusCode` and `message`) from `src/errors.ts`. `errorHandler` Express error middleware from `src/middleware/error-handler.ts`. Every later service/route throws these instead of raw errors.

- [ ] **Step 1: Write the failing test**

`apps/backend/test/error-handler.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { errorHandler } from '../src/middleware/error-handler.js';
import { NotFoundError, ValidationError } from '../src/errors.js';

function appWithRoute(handler: express.RequestHandler) {
  const app = express();
  app.get('/boom', handler);
  app.use(errorHandler);
  return app;
}

describe('errorHandler', () => {
  it('converts AppError subclasses to their status code and message', async () => {
    const app = appWithRoute(() => {
      throw new NotFoundError('Item not found');
    });
    const res = await request(app).get('/boom');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { message: 'Item not found' } });
  });

  it('converts a ValidationError to 400', async () => {
    const app = appWithRoute(() => {
      throw new ValidationError('Title is required');
    });
    const res = await request(app).get('/boom');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { message: 'Title is required' } });
  });

  it('converts unknown errors to a generic 500 without leaking details', async () => {
    const app = appWithRoute(() => {
      throw new Error('unexpected db failure with connection string');
    });
    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { message: 'Internal server error' } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && pnpm test -- error-handler.test.ts`
Expected: FAIL — `src/errors.ts` and `src/middleware/error-handler.ts` do not exist.

- [ ] **Step 3: Write `src/errors.ts`**

```typescript
export class AppError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(404, message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message);
  }
}
```

- [ ] **Step 4: Write `src/middleware/error-handler.ts`**

```typescript
import type { ErrorRequestHandler } from 'express';
import { AppError } from '../errors.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: { message: err.message } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { message: 'Internal server error' } });
};
```

- [ ] **Step 5: Mount the error handler in `src/app.ts`**

Add as the last `app.use(...)` call in `createApp()`, after all routes are mounted:
```typescript
import { errorHandler } from './middleware/error-handler.js';
// ...inside createApp(), after app.get('/health', ...):
app.use(errorHandler);
```

Also wrap the health handler (and every future route) so thrown errors reach it — Express 4 requires calling `next(err)` in async handlers. Add this tiny helper to `src/app.ts` and use it for every route added in later tasks:
```typescript
import type { RequestHandler } from 'express';

export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/backend && pnpm test -- error-handler.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/errors.ts apps/backend/src/middleware/error-handler.ts apps/backend/src/app.ts apps/backend/test/error-handler.test.ts
git commit -m "feat: add typed AppError hierarchy and error-handling middleware"
```

---

### Task 3: Prisma schema, migrations, seed, and DB test helpers

**Files:**
- Create: `apps/backend/prisma/schema.prisma`
- Create: `apps/backend/prisma/seed.ts`
- Create: `apps/backend/src/db.ts`
- Create: `apps/backend/test/helpers/db-reset.ts`
- Test: covered implicitly by every later routes test that calls `resetDb()`; this task's own check is Step 5 below.

**Interfaces:**
- Produces: Prisma client singleton `prisma` from `src/db.ts`. `resetDb(): Promise<void>` from `test/helpers/db-reset.ts` — truncates `status_events`, `item_photos`, `items`, `users` (not `categories`) and is called at the top of every routes test file's `beforeEach`.

- [ ] **Step 1: Write `prisma/schema.prisma`**

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  CONTRIBUTOR
  MODERATOR
}

enum ItemStatus {
  PENDING
  PUBLISHED
  REJECTED
  CANCELLED
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  name         String
  role         Role
  createdAt    DateTime @default(now())

  contributedItems Item[]        @relation("ContributedItems")
  reviewedItems    Item[]        @relation("ReviewedItems")
  statusEvents     StatusEvent[]

  @@map("users")
}

model Category {
  id    String @id @default(uuid())
  name  String @unique
  items Item[]

  @@map("categories")
}

model Item {
  id              String     @id @default(uuid())
  title           String
  description     String
  price           Decimal    @db.Decimal(10, 2)
  condition       String
  isNegotiable    Boolean    @default(false)
  minPrice        Decimal?   @db.Decimal(10, 2)
  categoryId      String
  category        Category   @relation(fields: [categoryId], references: [id])
  options         String[]
  contributorId   String
  contributor     User       @relation("ContributedItems", fields: [contributorId], references: [id])
  status          ItemStatus @default(PENDING)
  reviewedById    String?
  reviewedBy      User?      @relation("ReviewedItems", fields: [reviewedById], references: [id])
  reviewedAt      DateTime?
  rejectionReason String?
  aiFlagged       Boolean    @default(false)
  aiFlagReason    String?
  aiConfidence    Decimal?   @db.Decimal(4, 3)
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  photos       ItemPhoto[]
  statusEvents StatusEvent[]

  @@index([status])
  @@index([categoryId])
  @@map("items")
}

model ItemPhoto {
  id        String   @id @default(uuid())
  itemId    String
  item      Item     @relation(fields: [itemId], references: [id], onDelete: Cascade)
  url       String
  position  Int
  isPrimary Boolean  @default(false)
  createdAt DateTime @default(now())

  @@map("item_photos")
}

model StatusEvent {
  id         String   @id @default(uuid())
  itemId     String
  item       Item     @relation(fields: [itemId], references: [id], onDelete: Cascade)
  actorId    String?
  actor      User?    @relation(fields: [actorId], references: [id])
  fromStatus String?
  toStatus   String
  reason     String?
  createdAt  DateTime @default(now())

  @@map("status_events")
}
```

- [ ] **Step 2: Run the migration**

```bash
cd apps/backend
pnpm prisma:generate
pnpm prisma:migrate --name init
```
Expected: creates `prisma/migrations/<timestamp>_init/migration.sql` and applies it to the `reloop` database.

- [ ] **Step 3: Write `prisma/seed.ts`**

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const CATEGORY_NAMES = [
  'Electronics',
  'Furniture',
  'Clothing',
  'Vehicles',
  'Home & Garden',
  'Sports & Outdoors',
  'Toys & Games',
  'Other',
];

export async function seedCategories() {
  for (const name of CATEGORY_NAMES) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedCategories()
    .then(() => prisma.$disconnect())
    .catch(async (err) => {
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
```

- [ ] **Step 4: Write `src/db.ts`**

```typescript
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
```

- [ ] **Step 5: Write `test/helpers/db-reset.ts` and verify it against the running database**

```typescript
import { prisma } from '../../src/db.js';
import { seedCategories } from '../../prisma/seed.js';

export async function resetDb() {
  await prisma.statusEvent.deleteMany();
  await prisma.itemPhoto.deleteMany();
  await prisma.item.deleteMany();
  await prisma.user.deleteMany();
  await seedCategories();
}
```

Run the seed once and confirm categories land:
```bash
cd apps/backend && pnpm prisma:seed
```
Expected: no errors; `pnpm exec prisma studio` (or a `psql` `SELECT * FROM categories;`) shows the 8 seeded rows.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/prisma apps/backend/src/db.ts apps/backend/test/helpers/db-reset.ts
git commit -m "feat: add Prisma schema, migration, category seed, and test DB reset helper"
```

---

### Task 4: Storage port abstraction + local disk driver

**Files:**
- Create: `apps/backend/src/storage/storage-port.ts`
- Create: `apps/backend/src/storage/local-disk-storage.ts`
- Modify: `apps/backend/src/app.ts`
- Test: `apps/backend/test/storage/local-disk-storage.test.ts`

**Interfaces:**
- Produces: `interface StoragePort { save(file: UploadedFile): Promise<string>; delete(url: string): Promise<void>; }`, `type UploadedFile = { buffer: Buffer; originalName: string; mimeType: string }`, `createStorage(env: Env): StoragePort` from `src/storage/storage-port.ts`. Consumed by `items.service.ts` in Task 9.

- [ ] **Step 1: Write the failing test**

`apps/backend/test/storage/local-disk-storage.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { LocalDiskStorage } from '../../src/storage/local-disk-storage.js';

const TEST_DIR = path.resolve('./test-uploads-tmp');

describe('LocalDiskStorage', () => {
  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });
  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('saves a file to disk and returns a resolvable url', async () => {
    const storage = new LocalDiskStorage(TEST_DIR);
    const url = await storage.save({
      buffer: Buffer.from('fake-image-bytes'),
      originalName: 'photo.jpg',
      mimeType: 'image/jpeg',
    });

    expect(url).toMatch(/^\/uploads\/.+\.jpg$/);
    const savedPath = path.join(TEST_DIR, path.basename(url));
    expect(existsSync(savedPath)).toBe(true);
  });

  it('deletes a previously saved file', async () => {
    const storage = new LocalDiskStorage(TEST_DIR);
    const url = await storage.save({
      buffer: Buffer.from('fake-image-bytes'),
      originalName: 'photo.png',
      mimeType: 'image/png',
    });

    await storage.delete(url);

    const savedPath = path.join(TEST_DIR, path.basename(url));
    expect(existsSync(savedPath)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && pnpm test -- local-disk-storage.test.ts`
Expected: FAIL — `src/storage/local-disk-storage.ts` does not exist.

- [ ] **Step 3: Write `src/storage/storage-port.ts`**

```typescript
import type { Env } from '../env.js';
import { LocalDiskStorage } from './local-disk-storage.js';

export type UploadedFile = {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
};

export interface StoragePort {
  save(file: UploadedFile): Promise<string>;
  delete(url: string): Promise<void>;
}

export function createStorage(env: Env): StoragePort {
  if (env.storageDriver === 'local') {
    return new LocalDiskStorage(env.uploadsDir);
  }
  throw new Error(`Unsupported STORAGE_DRIVER: ${env.storageDriver}`);
}
```

- [ ] **Step 4: Write `src/storage/local-disk-storage.ts`**

```typescript
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import type { StoragePort, UploadedFile } from './storage-port.js';

export class LocalDiskStorage implements StoragePort {
  constructor(private readonly rootDir: string) {}

  async save(file: UploadedFile): Promise<string> {
    await mkdir(this.rootDir, { recursive: true });
    const ext = path.extname(file.originalName) || '';
    const filename = `${randomUUID()}${ext}`;
    await writeFile(path.join(this.rootDir, filename), file.buffer);
    return `/uploads/${filename}`;
  }

  async delete(url: string): Promise<void> {
    const filename = path.basename(url);
    await unlink(path.join(this.rootDir, filename)).catch((err) => {
      if (err.code !== 'ENOENT') throw err;
    });
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && pnpm test -- local-disk-storage.test.ts`
Expected: PASS

- [ ] **Step 6: Serve uploaded files statically**

Modify `src/app.ts` — add near the top of `createApp()`, before routes:
```typescript
import { loadEnv } from './env.js';
// ...inside createApp():
const env = loadEnv();
app.use('/uploads', express.static(env.uploadsDir));
```

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/storage apps/backend/src/app.ts apps/backend/test/storage
git commit -m "feat: add StoragePort abstraction with local-disk driver"
```

---

### Task 5: Auth utilities — password hashing & JWT

**Files:**
- Create: `apps/backend/src/auth/password.ts`
- Create: `apps/backend/src/auth/jwt.ts`
- Test: `apps/backend/test/auth/password.test.ts`
- Test: `apps/backend/test/auth/jwt.test.ts`

**Interfaces:**
- Produces: `hashPassword(plain: string): Promise<string>`, `verifyPassword(plain: string, hash: string): Promise<boolean>` from `src/auth/password.ts`. `signAccessToken(payload: { sub: string; role: Role }): string`, `verifyAccessToken(token: string): { sub: string; role: Role }` from `src/auth/jwt.ts` (throws on invalid/expired tokens).

- [ ] **Step 1: Write the failing tests**

`apps/backend/test/auth/password.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/auth/password.js';

describe('password hashing', () => {
  it('verifies a correct password against its hash', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    expect(await verifyPassword('correct-horse-battery-staple', hash)).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });
});
```

`apps/backend/test/auth/jwt.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { signAccessToken, verifyAccessToken } from '../../src/auth/jwt.js';

describe('jwt', () => {
  it('round-trips a signed payload', () => {
    const token = signAccessToken({ sub: 'user-1', role: 'CONTRIBUTOR' });
    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe('user-1');
    expect(decoded.role).toBe('CONTRIBUTOR');
  });

  it('throws on a garbage token', () => {
    expect(() => verifyAccessToken('not-a-real-token')).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/backend && pnpm test -- auth/password.test.ts auth/jwt.test.ts`
Expected: FAIL — modules don't exist.

- [ ] **Step 3: Write `src/auth/password.ts`**

```typescript
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

- [ ] **Step 4: Write `src/auth/jwt.ts`**

```typescript
import jwt from 'jsonwebtoken';
import { loadEnv } from '../env.js';
import type { Role } from '@prisma/client';

export type AccessTokenPayload = {
  sub: string;
  role: Role;
};

export function signAccessToken(payload: AccessTokenPayload): string {
  const env = loadEnv();
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const env = loadEnv();
  const decoded = jwt.verify(token, env.jwtSecret);
  if (typeof decoded === 'string' || !('sub' in decoded) || !('role' in decoded)) {
    throw new Error('Malformed token payload');
  }
  return { sub: decoded.sub as string, role: decoded.role as Role };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/backend && pnpm test -- auth/password.test.ts auth/jwt.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/auth/password.ts apps/backend/src/auth/jwt.ts apps/backend/test/auth
git commit -m "feat: add password hashing and JWT sign/verify utilities"
```

---

### Task 6: Auth endpoints — register & login

**Files:**
- Create: `apps/backend/src/auth/auth.service.ts`
- Create: `apps/backend/src/auth/auth.routes.ts`
- Modify: `apps/backend/src/app.ts`
- Test: `apps/backend/test/auth/auth.routes.test.ts`

**Interfaces:**
- Consumes: `hashPassword`, `verifyPassword` (Task 5), `signAccessToken` (Task 5), `prisma` (Task 3), `ConflictError`/`UnauthorizedError`/`ValidationError` (Task 2), `asyncHandler` (Task 2).
- Produces: `authRouter` (Express Router) mounted at `/auth` with `POST /auth/register` and `POST /auth/login`, both returning `{ token: string, user: { id, email, name, role } }`.

- [ ] **Step 1: Write the failing test**

`apps/backend/test/auth/auth.routes.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { resetDb } from '../helpers/db-reset.js';

const app = createApp();

describe('POST /auth/register', () => {
  beforeEach(resetDb);

  it('creates a contributor and returns a token', async () => {
    const res = await request(app).post('/auth/register').send({
      email: 'jordan@example.com',
      password: 'super-secret-1',
      name: 'Jordan',
      role: 'CONTRIBUTOR',
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({
      email: 'jordan@example.com',
      name: 'Jordan',
      role: 'CONTRIBUTOR',
    });
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects a duplicate email with 409', async () => {
    await request(app).post('/auth/register').send({
      email: 'dup@example.com',
      password: 'super-secret-1',
      name: 'First',
      role: 'CONTRIBUTOR',
    });

    const res = await request(app).post('/auth/register').send({
      email: 'dup@example.com',
      password: 'another-secret',
      name: 'Second',
      role: 'MODERATOR',
    });

    expect(res.status).toBe(409);
  });
});

describe('POST /auth/login', () => {
  beforeEach(resetDb);

  it('logs in with correct credentials', async () => {
    await request(app).post('/auth/register').send({
      email: 'morgan@example.com',
      password: 'super-secret-1',
      name: 'Morgan',
      role: 'MODERATOR',
    });

    const res = await request(app).post('/auth/login').send({
      email: 'morgan@example.com',
      password: 'super-secret-1',
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.role).toBe('MODERATOR');
  });

  it('rejects the wrong password with 401', async () => {
    await request(app).post('/auth/register').send({
      email: 'morgan2@example.com',
      password: 'super-secret-1',
      name: 'Morgan',
      role: 'MODERATOR',
    });

    const res = await request(app).post('/auth/login').send({
      email: 'morgan2@example.com',
      password: 'wrong-password',
    });

    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && pnpm test -- auth/auth.routes.test.ts`
Expected: FAIL — `/auth/register` returns 404 (route doesn't exist yet).

- [ ] **Step 3: Write `src/auth/auth.service.ts`**

```typescript
import { prisma } from '../db.js';
import { hashPassword, verifyPassword } from './password.js';
import { signAccessToken } from './jwt.js';
import { ConflictError, UnauthorizedError } from '../errors.js';
import type { Role } from '@prisma/client';

export async function register(input: { email: string; password: string; name: string; role: Role }) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new ConflictError('An account with this email already exists');
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      name: input.name,
      role: input.role,
    },
  });

  const token = signAccessToken({ sub: user.id, role: user.role });
  return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
}

export async function login(input: { email: string; password: string }) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const token = signAccessToken({ sub: user.id, role: user.role });
  return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
}
```

- [ ] **Step 4: Write `src/auth/auth.routes.ts`**

```typescript
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../app.js';
import { register, login } from './auth.service.js';
import { ValidationError } from '../errors.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(['CONTRIBUTOR', 'MODERATOR']),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authRouter = Router();

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0].message);
    }
    const result = await register(parsed.data);
    res.status(201).json(result);
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0].message);
    }
    const result = await login(parsed.data);
    res.status(200).json(result);
  }),
);
```

Note: `asyncHandler` is exported from `src/app.ts` (Task 2) — move it to its own file if `app.ts` importing from `auth.routes.ts` which imports back from `app.ts` ever creates a cycle in your editor's judgment. Circular import risk here is limited to a same-module `export function`, but if you'd rather avoid it, extract `asyncHandler` to a new `src/async-handler.ts` and update Task 2's Step 5 import in `app.ts` accordingly before continuing.

- [ ] **Step 5: Mount the auth router in `src/app.ts`**

```typescript
import { authRouter } from './auth/auth.routes.js';
// ...inside createApp(), after the /uploads static middleware, before errorHandler:
app.use('/auth', authRouter);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/backend && pnpm test -- auth/auth.routes.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/auth apps/backend/src/app.ts apps/backend/test/auth/auth.routes.test.ts
git commit -m "feat: add register and login endpoints"
```

---

### Task 7: Auth middleware — requireAuth, requireRole, attachUserIfPresent

**Files:**
- Create: `apps/backend/src/middleware/auth.ts`
- Modify: `apps/backend/src/app.ts` (type augmentation for `req.user`)
- Test: `apps/backend/test/middleware/auth.test.ts`

**Interfaces:**
- Consumes: `verifyAccessToken` (Task 5), `UnauthorizedError`/`ForbiddenError` (Task 2).
- Produces: `requireAuth: RequestHandler` (sets `req.user = { id, role }` or throws 401), `requireRole(role: Role): RequestHandler` (throws 403 if `req.user.role !== role`), `attachUserIfPresent: RequestHandler` (best-effort — sets `req.user` if a valid Bearer token is present, otherwise leaves it undefined and never throws). Consumed by every protected route in Tasks 9–13.

- [ ] **Step 1: Write the failing test**

`apps/backend/test/middleware/auth.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import { requireAuth, requireRole, attachUserIfPresent } from '../../src/middleware/auth.js';
import { signAccessToken } from '../../src/auth/jwt.js';

function mockReqRes(headers: Record<string, string> = {}) {
  const req = { headers } as unknown as Request;
  const res = {} as Response;
  const next = vi.fn();
  return { req, res, next };
}

describe('requireAuth', () => {
  it('rejects a missing token with 401', () => {
    const { req, res, next } = mockReqRes();
    expect(() => requireAuth(req, res, next)).toThrow(expect.objectContaining({ statusCode: 401 }));
  });

  it('rejects an invalid token with 401', () => {
    const { req, res, next } = mockReqRes({ authorization: 'Bearer garbage' });
    expect(() => requireAuth(req, res, next)).toThrow(expect.objectContaining({ statusCode: 401 }));
  });

  it('attaches req.user and calls next for a valid token', () => {
    const token = signAccessToken({ sub: 'user-1', role: 'MODERATOR' });
    const { req, res, next } = mockReqRes({ authorization: `Bearer ${token}` });
    requireAuth(req, res, next);
    expect(req.user).toEqual({ id: 'user-1', role: 'MODERATOR' });
    expect(next).toHaveBeenCalledOnce();
  });
});

describe('requireRole', () => {
  it('throws 403 when the role does not match', () => {
    const { req, res, next } = mockReqRes();
    req.user = { id: 'user-1', role: 'CONTRIBUTOR' };
    expect(() => requireRole('MODERATOR')(req, res, next)).toThrow(
      expect.objectContaining({ statusCode: 403 }),
    );
  });

  it('calls next when the role matches', () => {
    const { req, res, next } = mockReqRes();
    req.user = { id: 'user-1', role: 'MODERATOR' };
    requireRole('MODERATOR')(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});

describe('attachUserIfPresent', () => {
  it('leaves req.user undefined and calls next when there is no token', () => {
    const { req, res, next } = mockReqRes();
    attachUserIfPresent(req, res, next);
    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });

  it('attaches req.user when a valid token is present', () => {
    const token = signAccessToken({ sub: 'user-2', role: 'CONTRIBUTOR' });
    const { req, res, next } = mockReqRes({ authorization: `Bearer ${token}` });
    attachUserIfPresent(req, res, next);
    expect(req.user).toEqual({ id: 'user-2', role: 'CONTRIBUTOR' });
    expect(next).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && pnpm test -- middleware/auth.test.ts`
Expected: FAIL — `src/middleware/auth.ts` does not exist.

- [ ] **Step 3: Write `src/middleware/auth.ts`**

```typescript
import type { RequestHandler } from 'express';
import type { Role } from '@prisma/client';
import { verifyAccessToken } from '../auth/jwt.js';
import { UnauthorizedError, ForbiddenError } from '../errors.js';

function extractBearerToken(header: string | undefined): string | null {
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length);
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    throw new UnauthorizedError('Missing bearer token');
  }
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }
};

export function requireRole(role: Role): RequestHandler {
  return (req, _res, next) => {
    if (req.user?.role !== role) {
      throw new ForbiddenError(`Requires ${role} role`);
    }
    next();
  };
}

export const attachUserIfPresent: RequestHandler = (req, _res, next) => {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    next();
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
  } catch {
    // best-effort — an invalid token on a public route just means anonymous
  }
  next();
};
```

- [ ] **Step 4: Add the `req.user` type augmentation**

Create `apps/backend/src/types/express.d.ts`:
```typescript
import type { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: Role };
    }
  }
}

export {};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && pnpm test -- middleware/auth.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/middleware/auth.ts apps/backend/src/types/express.d.ts apps/backend/test/middleware/auth.test.ts
git commit -m "feat: add requireAuth, requireRole, and attachUserIfPresent middleware"
```

---

### Task 8: Categories endpoint

**Files:**
- Create: `apps/backend/src/categories/categories.service.ts`
- Create: `apps/backend/src/categories/categories.routes.ts`
- Modify: `apps/backend/src/app.ts`
- Test: `apps/backend/test/categories/categories.routes.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 3), `asyncHandler` (Task 2).
- Produces: `listCategories(): Promise<{ id: string; name: string }[]>` from `categories.service.ts`. `categoriesRouter` mounted at `/categories` with `GET /categories`. Consumed by `items.schemas.ts` (Task 9) indirectly via `categoryId` validation against the DB.

- [ ] **Step 1: Write the failing test**

`apps/backend/test/categories/categories.routes.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { resetDb } from '../helpers/db-reset.js';
import { CATEGORY_NAMES } from '../../prisma/seed.js';

const app = createApp();

describe('GET /categories', () => {
  beforeEach(resetDb);

  it('returns all seeded categories', async () => {
    const res = await request(app).get('/categories');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(CATEGORY_NAMES.length);
    expect(res.body.map((c: { name: string }) => c.name).sort()).toEqual(
      [...CATEGORY_NAMES].sort(),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && pnpm test -- categories/categories.routes.test.ts`
Expected: FAIL — 404, route not mounted.

- [ ] **Step 3: Write `src/categories/categories.service.ts`**

```typescript
import { prisma } from '../db.js';

export async function listCategories() {
  return prisma.category.findMany({ orderBy: { name: 'asc' } });
}
```

- [ ] **Step 4: Write `src/categories/categories.routes.ts`**

```typescript
import { Router } from 'express';
import { asyncHandler } from '../app.js';
import { listCategories } from './categories.service.js';

export const categoriesRouter = Router();

categoriesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const categories = await listCategories();
    res.json(categories);
  }),
);
```

- [ ] **Step 5: Mount in `src/app.ts`**

```typescript
import { categoriesRouter } from './categories/categories.routes.js';
// ...inside createApp(), alongside app.use('/auth', authRouter):
app.use('/categories', categoriesRouter);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/backend && pnpm test -- categories/categories.routes.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/categories apps/backend/src/app.ts apps/backend/test/categories
git commit -m "feat: add GET /categories endpoint"
```

---

### Task 9: Items — create

**Files:**
- Create: `apps/backend/src/items/items.constants.ts`
- Create: `apps/backend/src/items/items.schemas.ts`
- Create: `apps/backend/src/items/items.serialize.ts`
- Create: `apps/backend/src/items/items.service.ts`
- Create: `apps/backend/src/items/items.routes.ts`
- Modify: `apps/backend/src/app.ts`
- Test: `apps/backend/test/items/items.create.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 3), `createStorage` (Task 4), `requireAuth`/`requireRole` (Task 7), `ValidationError` (Task 2).
- Produces: `CONDITIONS`, `LISTING_OPTIONS` (readonly string arrays) from `items.constants.ts`. `createItemBodySchema` (Zod) + `CreateItemInput` type from `items.schemas.ts`. `serializeItem(item): ItemDto` from `items.serialize.ts` — converts Prisma `Decimal`s to numbers and shapes the JSON response; every later items/moderation route reuses this. `createItem(contributorId: string, input: CreateItemInput, photos: UploadedFile[]): Promise<ItemDto>` from `items.service.ts`. `itemsRouter` mounted at `/items` with `POST /items`.

- [ ] **Step 1: Write `src/items/items.constants.ts`**

```typescript
export const CONDITIONS = ['New', 'Like new', 'Good', 'Fair', 'For parts'] as const;
export type Condition = (typeof CONDITIONS)[number];

export const LISTING_OPTIONS = [
  'Delivery available',
  'Local pickup',
  'Open to trades',
  'Original packaging',
  'Warranty included',
  'Bundle deal',
] as const;
export type ListingOption = (typeof LISTING_OPTIONS)[number];
```

- [ ] **Step 2: Write `src/items/items.schemas.ts`**

```typescript
import { z } from 'zod';
import { CONDITIONS, LISTING_OPTIONS } from './items.constants.js';

export const createItemBodySchema = z
  .object({
    title: z.string().min(1),
    description: z.string().min(1),
    price: z.coerce.number().positive(),
    condition: z.enum(CONDITIONS),
    isNegotiable: z.coerce.boolean(),
    minPrice: z.coerce.number().positive().optional(),
    categoryId: z.string().uuid(),
    options: z.array(z.enum(LISTING_OPTIONS)).default([]),
  })
  .refine((data) => !data.isNegotiable || data.minPrice !== undefined, {
    message: 'minPrice is required when isNegotiable is true',
    path: ['minPrice'],
  });

export type CreateItemInput = z.infer<typeof createItemBodySchema>;

export const updateItemBodySchema = createItemBodySchema;
export type UpdateItemInput = z.infer<typeof updateItemBodySchema>;
```

- [ ] **Step 3: Write the failing test**

`apps/backend/test/items/items.create.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { resetDb } from '../helpers/db-reset.js';
import { prisma } from '../../src/db.js';
import { registerAndLogin } from '../helpers/factories.js';

const app = createApp();

describe('POST /items', () => {
  beforeEach(resetDb);

  it('lets a contributor create a listing with a photo, entering pending review', async () => {
    const { token } = await registerAndLogin(app, 'CONTRIBUTOR');
    const category = await prisma.category.findFirstOrThrow();

    const res = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Solid Oak Bookshelf')
      .field('description', 'Five adjustable shelves, honey finish.')
      .field('price', '85')
      .field('condition', 'Like new')
      .field('isNegotiable', 'false')
      .field('categoryId', category.id)
      .field('options', JSON.stringify(['Local pickup']))
      .attach('photos', Buffer.from('fake-image-bytes'), 'bookshelf.jpg');

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING');
    expect(res.body.photos).toHaveLength(1);
    expect(res.body.photos[0].isPrimary).toBe(true);

    const events = await prisma.statusEvent.findMany({ where: { itemId: res.body.id } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ fromStatus: null, toStatus: 'PENDING' });
  });

  it('rejects a listing with no photos', async () => {
    const { token } = await registerAndLogin(app, 'CONTRIBUTOR');
    const category = await prisma.category.findFirstOrThrow();

    const res = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'No Photo Item')
      .field('description', 'Missing photos.')
      .field('price', '10')
      .field('condition', 'Good')
      .field('isNegotiable', 'false')
      .field('categoryId', category.id)
      .field('options', JSON.stringify([]));

    expect(res.status).toBe(400);
  });

  it('rejects isNegotiable=true without a minPrice', async () => {
    const { token } = await registerAndLogin(app, 'CONTRIBUTOR');
    const category = await prisma.category.findFirstOrThrow();

    const res = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Negotiable Item')
      .field('description', 'Needs a min price.')
      .field('price', '50')
      .field('condition', 'Good')
      .field('isNegotiable', 'true')
      .field('categoryId', category.id)
      .field('options', JSON.stringify([]))
      .attach('photos', Buffer.from('fake-image-bytes'), 'item.jpg');

    expect(res.status).toBe(400);
  });

  it('rejects a moderator trying to create a listing', async () => {
    const { token } = await registerAndLogin(app, 'MODERATOR');
    const category = await prisma.category.findFirstOrThrow();

    const res = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Not Allowed')
      .field('description', 'Moderators cannot create.')
      .field('price', '10')
      .field('condition', 'Good')
      .field('isNegotiable', 'false')
      .field('categoryId', category.id)
      .field('options', JSON.stringify([]))
      .attach('photos', Buffer.from('fake-image-bytes'), 'item.jpg');

    expect(res.status).toBe(403);
  });

  it('rejects an unauthenticated request', async () => {
    const category = await prisma.category.findFirstOrThrow();
    const res = await request(app)
      .post('/items')
      .field('title', 'Anon Item')
      .field('description', 'No auth.')
      .field('price', '10')
      .field('condition', 'Good')
      .field('isNegotiable', 'false')
      .field('categoryId', category.id)
      .field('options', JSON.stringify([]))
      .attach('photos', Buffer.from('fake-image-bytes'), 'item.jpg');

    expect(res.status).toBe(401);
  });
});
```

Create the shared test factory this depends on, `apps/backend/test/helpers/factories.ts`:
```typescript
import request from 'supertest';
import type { Express } from 'express';
import type { Role } from '@prisma/client';

let counter = 0;

export async function registerAndLogin(app: Express, role: Role) {
  counter += 1;
  const email = `test-user-${counter}@example.com`;
  const res = await request(app).post('/auth/register').send({
    email,
    password: 'super-secret-1',
    name: `Test User ${counter}`,
    role,
  });
  return { token: res.body.token as string, user: res.body.user };
}
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd apps/backend && pnpm test -- items/items.create.test.ts`
Expected: FAIL — 404, route not mounted.

- [ ] **Step 5: Write `src/items/items.serialize.ts`**

```typescript
import type { Item, ItemPhoto } from '@prisma/client';

export type ItemDto = ReturnType<typeof serializeItem>;

export function serializeItem(item: Item & { photos?: ItemPhoto[] }) {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    price: item.price.toNumber(),
    condition: item.condition,
    isNegotiable: item.isNegotiable,
    minPrice: item.minPrice ? item.minPrice.toNumber() : null,
    categoryId: item.categoryId,
    options: item.options,
    contributorId: item.contributorId,
    status: item.status,
    reviewedById: item.reviewedById,
    reviewedAt: item.reviewedAt,
    rejectionReason: item.rejectionReason,
    aiFlagged: item.aiFlagged,
    aiFlagReason: item.aiFlagReason,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    photos: (item.photos ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((p) => ({ id: p.id, url: p.url, position: p.position, isPrimary: p.isPrimary })),
  };
}
```

- [ ] **Step 6: Write `src/items/items.service.ts`**

```typescript
import { prisma } from '../db.js';
import { createStorage } from '../storage/storage-port.js';
import type { UploadedFile } from '../storage/storage-port.js';
import { loadEnv } from '../env.js';
import { serializeItem } from './items.serialize.js';
import type { CreateItemInput } from './items.schemas.js';

const storage = createStorage(loadEnv());

export async function createItem(contributorId: string, input: CreateItemInput, photos: UploadedFile[]) {
  const savedUrls = await Promise.all(photos.map((photo) => storage.save(photo)));

  const item = await prisma.item.create({
    data: {
      title: input.title,
      description: input.description,
      price: input.price,
      condition: input.condition,
      isNegotiable: input.isNegotiable,
      minPrice: input.minPrice ?? null,
      categoryId: input.categoryId,
      options: input.options,
      contributorId,
      status: 'PENDING',
      photos: {
        create: savedUrls.map((url, index) => ({
          url,
          position: index,
          isPrimary: index === 0,
        })),
      },
      statusEvents: {
        create: {
          actorId: contributorId,
          fromStatus: null,
          toStatus: 'PENDING',
        },
      },
    },
    include: { photos: true },
  });

  return serializeItem(item);
}
```

- [ ] **Step 7: Write `src/items/items.routes.ts`**

```typescript
import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../app.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { createItemBodySchema } from './items.schemas.js';
import { createItem } from './items.service.js';
import { ValidationError } from '../errors.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

export const itemsRouter = Router();

function parseMultipartBody(body: Record<string, string>) {
  return {
    ...body,
    options: body.options ? JSON.parse(body.options) : [],
  };
}

itemsRouter.post(
  '/',
  requireAuth,
  requireRole('CONTRIBUTOR'),
  upload.array('photos', 10),
  asyncHandler(async (req, res) => {
    const files = (req.files as Express.Multer.File[]) ?? [];
    if (files.length === 0) {
      throw new ValidationError('At least one photo is required');
    }

    const parsed = createItemBodySchema.safeParse(parseMultipartBody(req.body));
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0].message);
    }

    const item = await createItem(
      req.user!.id,
      parsed.data,
      files.map((f) => ({ buffer: f.buffer, originalName: f.originalname, mimeType: f.mimetype })),
    );
    res.status(201).json(item);
  }),
);
```

- [ ] **Step 8: Mount in `src/app.ts`**

```typescript
import { itemsRouter } from './items/items.routes.js';
// ...inside createApp():
app.use('/items', itemsRouter);
```

- [ ] **Step 9: Run test to verify it passes**

Run: `cd apps/backend && pnpm test -- items/items.create.test.ts`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add apps/backend/src/items apps/backend/src/app.ts apps/backend/test/items/items.create.test.ts apps/backend/test/helpers/factories.ts
git commit -m "feat: add POST /items for contributor listing creation"
```

---

### Task 10: Items — public list & detail

**Files:**
- Modify: `apps/backend/src/items/items.service.ts`
- Modify: `apps/backend/src/items/items.routes.ts`
- Test: `apps/backend/test/items/items.read.test.ts`

**Interfaces:**
- Consumes: `serializeItem` (Task 9), `attachUserIfPresent` (Task 7).
- Produces: `listItems(filters: { status?: ItemStatus; categoryId?: string; condition?: string; search?: string; page?: number; pageSize?: number }, requester?: { id: string; role: Role }): Promise<ItemDto[]>` and `getItemById(id: string, requester?: { id: string; role: Role }): Promise<ItemDto>` (throws `NotFoundError` if the item isn't published and the requester isn't its owner or a moderator) added to `items.service.ts`. Routes: `GET /items`, `GET /items/:id`.

- [ ] **Step 1: Write the failing test**

`apps/backend/test/items/items.read.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { resetDb } from '../helpers/db-reset.js';
import { prisma } from '../../src/db.js';
import { registerAndLogin } from '../helpers/factories.js';

const app = createApp();

async function createPendingItem(token: string, categoryId: string, overrides: Partial<Record<string, string>> = {}) {
  const res = await request(app)
    .post('/items')
    .set('Authorization', `Bearer ${token}`)
    .field('title', overrides.title ?? 'Test Item')
    .field('description', 'A test item.')
    .field('price', overrides.price ?? '20')
    .field('condition', overrides.condition ?? 'Good')
    .field('isNegotiable', 'false')
    .field('categoryId', categoryId)
    .field('options', JSON.stringify([]))
    .attach('photos', Buffer.from('fake-image-bytes'), 'item.jpg');
  return res.body;
}

describe('GET /items and GET /items/:id', () => {
  beforeEach(resetDb);

  it('excludes pending items from the public list', async () => {
    const { token } = await registerAndLogin(app, 'CONTRIBUTOR');
    const category = await prisma.category.findFirstOrThrow();
    await createPendingItem(token, category.id);

    const res = await request(app).get('/items');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('returns published items to the public', async () => {
    const { token } = await registerAndLogin(app, 'CONTRIBUTOR');
    const category = await prisma.category.findFirstOrThrow();
    const item = await createPendingItem(token, category.id, { title: 'Published Item' });
    await prisma.item.update({ where: { id: item.id }, data: { status: 'PUBLISHED' } });

    const res = await request(app).get('/items');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Published Item');
  });

  it('lets a moderator see pending items in the list', async () => {
    const { token: contributorToken } = await registerAndLogin(app, 'CONTRIBUTOR');
    const { token: modToken } = await registerAndLogin(app, 'MODERATOR');
    const category = await prisma.category.findFirstOrThrow();
    await createPendingItem(contributorToken, category.id);

    const res = await request(app)
      .get('/items?status=PENDING')
      .set('Authorization', `Bearer ${modToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('returns 404 for a pending item detail requested anonymously', async () => {
    const { token } = await registerAndLogin(app, 'CONTRIBUTOR');
    const category = await prisma.category.findFirstOrThrow();
    const item = await createPendingItem(token, category.id);

    const res = await request(app).get(`/items/${item.id}`);
    expect(res.status).toBe(404);
  });

  it('returns a pending item detail to a moderator', async () => {
    const { token: contributorToken } = await registerAndLogin(app, 'CONTRIBUTOR');
    const { token: modToken } = await registerAndLogin(app, 'MODERATOR');
    const category = await prisma.category.findFirstOrThrow();
    const item = await createPendingItem(contributorToken, category.id);

    const res = await request(app)
      .get(`/items/${item.id}`)
      .set('Authorization', `Bearer ${modToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(item.id);
  });

  it('filters the public list by category', async () => {
    const { token } = await registerAndLogin(app, 'CONTRIBUTOR');
    const categories = await prisma.category.findMany();
    const itemA = await createPendingItem(token, categories[0].id, { title: 'A' });
    const itemB = await createPendingItem(token, categories[1].id, { title: 'B' });
    await prisma.item.update({ where: { id: itemA.id }, data: { status: 'PUBLISHED' } });
    await prisma.item.update({ where: { id: itemB.id }, data: { status: 'PUBLISHED' } });

    const res = await request(app).get(`/items?categoryId=${categories[0].id}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('A');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && pnpm test -- items/items.read.test.ts`
Expected: FAIL — `GET /items` returns 404.

- [ ] **Step 3: Add `listItems` and `getItemById` to `src/items/items.service.ts`**

```typescript
import type { Role, ItemStatus, Prisma } from '@prisma/client';
import { NotFoundError } from '../errors.js';
// ...(keep existing imports and createItem)

export type ItemFilters = {
  status?: ItemStatus;
  categoryId?: string;
  condition?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type Requester = { id: string; role: Role } | undefined;

export async function listItems(filters: ItemFilters, requester: Requester) {
  const isModerator = requester?.role === 'MODERATOR';
  const where: Prisma.ItemWhereInput = {
    status: isModerator && filters.status ? filters.status : 'PUBLISHED',
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.condition ? { condition: filters.condition } : {}),
    ...(filters.search ? { title: { contains: filters.search, mode: 'insensitive' } } : {}),
  };

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 24;

  const items = await prisma.item.findMany({
    where,
    include: { photos: true },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return items.map(serializeItem);
}

export async function getItemById(id: string, requester: Requester) {
  const item = await prisma.item.findUnique({ where: { id }, include: { photos: true } });
  if (!item) {
    throw new NotFoundError('Item not found');
  }

  const isOwner = requester?.id === item.contributorId;
  const isModerator = requester?.role === 'MODERATOR';
  if (item.status !== 'PUBLISHED' && !isOwner && !isModerator) {
    throw new NotFoundError('Item not found');
  }

  return serializeItem(item);
}
```

- [ ] **Step 4: Add the routes to `src/items/items.routes.ts`**

```typescript
import { attachUserIfPresent } from '../middleware/auth.js';
import { listItems, getItemById } from './items.service.js';
import type { ItemStatus } from '@prisma/client';
// ...(keep existing imports and POST route)

itemsRouter.get(
  '/',
  attachUserIfPresent,
  asyncHandler(async (req, res) => {
    const { status, categoryId, condition, search, page, pageSize } = req.query;
    const items = await listItems(
      {
        status: typeof status === 'string' ? (status as ItemStatus) : undefined,
        categoryId: typeof categoryId === 'string' ? categoryId : undefined,
        condition: typeof condition === 'string' ? condition : undefined,
        search: typeof search === 'string' ? search : undefined,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      },
      req.user,
    );
    res.json(items);
  }),
);

itemsRouter.get(
  '/:id',
  attachUserIfPresent,
  asyncHandler(async (req, res) => {
    const item = await getItemById(req.params.id, req.user);
    res.json(item);
  }),
);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && pnpm test -- items/items.read.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/items apps/backend/test/items/items.read.test.ts
git commit -m "feat: add public GET /items and GET /items/:id with moderator visibility"
```

---

### Task 11: Items — contributor cancel

**Files:**
- Modify: `apps/backend/src/items/items.service.ts`
- Modify: `apps/backend/src/items/items.routes.ts`
- Test: `apps/backend/test/items/items.cancel.test.ts`

**Interfaces:**
- Consumes: `requireAuth`, `requireRole` (Task 7), `ForbiddenError`, `ConflictError`, `NotFoundError` (Task 2).
- Produces: `cancelItem(id: string, requesterId: string): Promise<ItemDto>` added to `items.service.ts` (throws `NotFoundError` if missing, `ForbiddenError` if not the owner, `ConflictError` if already `REJECTED`/`CANCELLED`). Route: `PATCH /items/:id/cancel`.

- [ ] **Step 1: Write the failing test**

`apps/backend/test/items/items.cancel.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { resetDb } from '../helpers/db-reset.js';
import { prisma } from '../../src/db.js';
import { registerAndLogin } from '../helpers/factories.js';

const app = createApp();

async function createItem(token: string, categoryId: string) {
  const res = await request(app)
    .post('/items')
    .set('Authorization', `Bearer ${token}`)
    .field('title', 'Cancel Me')
    .field('description', 'For cancel tests.')
    .field('price', '15')
    .field('condition', 'Good')
    .field('isNegotiable', 'false')
    .field('categoryId', categoryId)
    .field('options', JSON.stringify([]))
    .attach('photos', Buffer.from('fake-image-bytes'), 'item.jpg');
  return res.body;
}

describe('PATCH /items/:id/cancel', () => {
  beforeEach(resetDb);

  it('lets the owning contributor cancel a pending item', async () => {
    const { token } = await registerAndLogin(app, 'CONTRIBUTOR');
    const category = await prisma.category.findFirstOrThrow();
    const item = await createItem(token, category.id);

    const res = await request(app)
      .patch(`/items/${item.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');

    const events = await prisma.statusEvent.findMany({
      where: { itemId: item.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(events.at(-1)).toMatchObject({ fromStatus: 'PENDING', toStatus: 'CANCELLED' });
  });

  it('rejects cancellation by a different contributor', async () => {
    const { token: ownerToken } = await registerAndLogin(app, 'CONTRIBUTOR');
    const { token: otherToken } = await registerAndLogin(app, 'CONTRIBUTOR');
    const category = await prisma.category.findFirstOrThrow();
    const item = await createItem(ownerToken, category.id);

    const res = await request(app)
      .patch(`/items/${item.id}/cancel`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });

  it('rejects cancelling an already-rejected item', async () => {
    const { token } = await registerAndLogin(app, 'CONTRIBUTOR');
    const category = await prisma.category.findFirstOrThrow();
    const item = await createItem(token, category.id);
    await prisma.item.update({ where: { id: item.id }, data: { status: 'REJECTED' } });

    const res = await request(app)
      .patch(`/items/${item.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && pnpm test -- items/items.cancel.test.ts`
Expected: FAIL — 404, route not mounted.

- [ ] **Step 3: Add `cancelItem` to `src/items/items.service.ts`**

```typescript
import { ForbiddenError, ConflictError } from '../errors.js';
// ...(keep existing imports)

export async function cancelItem(id: string, requesterId: string) {
  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) {
    throw new NotFoundError('Item not found');
  }
  if (item.contributorId !== requesterId) {
    throw new ForbiddenError('You can only cancel your own listings');
  }
  if (item.status !== 'PENDING' && item.status !== 'PUBLISHED') {
    throw new ConflictError(`Cannot cancel an item with status ${item.status}`);
  }

  const updated = await prisma.item.update({
    where: { id },
    data: {
      status: 'CANCELLED',
      statusEvents: {
        create: { actorId: requesterId, fromStatus: item.status, toStatus: 'CANCELLED' },
      },
    },
    include: { photos: true },
  });

  return serializeItem(updated);
}
```

- [ ] **Step 4: Add the route to `src/items/items.routes.ts`**

```typescript
import { cancelItem } from './items.service.js';
// ...(keep existing imports and routes)

itemsRouter.patch(
  '/:id/cancel',
  requireAuth,
  requireRole('CONTRIBUTOR'),
  asyncHandler(async (req, res) => {
    const item = await cancelItem(req.params.id, req.user!.id);
    res.json(item);
  }),
);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && pnpm test -- items/items.cancel.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/items apps/backend/test/items/items.cancel.test.ts
git commit -m "feat: let contributors cancel their own listings"
```

---

### Task 12: Items — moderator edit & delete

**Files:**
- Modify: `apps/backend/src/items/items.service.ts`
- Modify: `apps/backend/src/items/items.routes.ts`
- Test: `apps/backend/test/items/items.moderator-edit-delete.test.ts`

**Interfaces:**
- Consumes: `updateItemBodySchema` (Task 9), `requireAuth`/`requireRole` (Task 7).
- Produces: `updateItem(id: string, input: UpdateItemInput): Promise<ItemDto>` and `deleteItem(id: string): Promise<void>` (deletes each photo via the storage port, then the item — cascades `item_photos`/`status_events`) added to `items.service.ts`. Routes: `PUT /items/:id`, `DELETE /items/:id`.

- [ ] **Step 1: Write the failing test**

`apps/backend/test/items/items.moderator-edit-delete.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { resetDb } from '../helpers/db-reset.js';
import { prisma } from '../../src/db.js';
import { registerAndLogin } from '../helpers/factories.js';

const app = createApp();

async function createItem(token: string, categoryId: string) {
  const res = await request(app)
    .post('/items')
    .set('Authorization', `Bearer ${token}`)
    .field('title', 'Editable Item')
    .field('description', 'Original description.')
    .field('price', '30')
    .field('condition', 'Good')
    .field('isNegotiable', 'false')
    .field('categoryId', categoryId)
    .field('options', JSON.stringify([]))
    .attach('photos', Buffer.from('fake-image-bytes'), 'item.jpg');
  return res.body;
}

describe('PUT /items/:id and DELETE /items/:id (moderator)', () => {
  beforeEach(resetDb);

  it('lets a moderator edit any item', async () => {
    const { token: contributorToken } = await registerAndLogin(app, 'CONTRIBUTOR');
    const { token: modToken } = await registerAndLogin(app, 'MODERATOR');
    const category = await prisma.category.findFirstOrThrow();
    const item = await createItem(contributorToken, category.id);

    const res = await request(app)
      .put(`/items/${item.id}`)
      .set('Authorization', `Bearer ${modToken}`)
      .send({
        title: 'Corrected Title',
        description: 'Corrected description.',
        price: 40,
        condition: 'Fair',
        isNegotiable: false,
        categoryId: category.id,
        options: ['Local pickup'],
      });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Corrected Title');
    expect(res.body.price).toBe(40);
  });

  it('rejects a contributor trying to edit an item', async () => {
    const { token: contributorToken } = await registerAndLogin(app, 'CONTRIBUTOR');
    const category = await prisma.category.findFirstOrThrow();
    const item = await createItem(contributorToken, category.id);

    const res = await request(app)
      .put(`/items/${item.id}`)
      .set('Authorization', `Bearer ${contributorToken}`)
      .send({
        title: 'Hijacked',
        description: 'x',
        price: 1,
        condition: 'Fair',
        isNegotiable: false,
        categoryId: category.id,
        options: [],
      });

    expect(res.status).toBe(403);
  });

  it('lets a moderator delete any item', async () => {
    const { token: contributorToken } = await registerAndLogin(app, 'CONTRIBUTOR');
    const { token: modToken } = await registerAndLogin(app, 'MODERATOR');
    const category = await prisma.category.findFirstOrThrow();
    const item = await createItem(contributorToken, category.id);

    const res = await request(app)
      .delete(`/items/${item.id}`)
      .set('Authorization', `Bearer ${modToken}`);

    expect(res.status).toBe(204);
    const found = await prisma.item.findUnique({ where: { id: item.id } });
    expect(found).toBeNull();
  });

  it('returns 404 when editing a non-existent item', async () => {
    const { token: modToken } = await registerAndLogin(app, 'MODERATOR');
    const category = await prisma.category.findFirstOrThrow();

    const res = await request(app)
      .put('/items/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${modToken}`)
      .send({
        title: 'Ghost',
        description: 'x',
        price: 1,
        condition: 'Fair',
        isNegotiable: false,
        categoryId: category.id,
        options: [],
      });

    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && pnpm test -- items/items.moderator-edit-delete.test.ts`
Expected: FAIL — routes not mounted.

- [ ] **Step 3: Add `updateItem` and `deleteItem` to `src/items/items.service.ts`**

```typescript
import type { UpdateItemInput } from './items.schemas.js';
// ...(keep existing imports)

export async function updateItem(id: string, input: UpdateItemInput) {
  const existing = await prisma.item.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Item not found');
  }

  const updated = await prisma.item.update({
    where: { id },
    data: {
      title: input.title,
      description: input.description,
      price: input.price,
      condition: input.condition,
      isNegotiable: input.isNegotiable,
      minPrice: input.minPrice ?? null,
      categoryId: input.categoryId,
      options: input.options,
    },
    include: { photos: true },
  });

  return serializeItem(updated);
}

export async function deleteItem(id: string) {
  const item = await prisma.item.findUnique({ where: { id }, include: { photos: true } });
  if (!item) {
    throw new NotFoundError('Item not found');
  }

  await Promise.all(item.photos.map((photo) => storage.delete(photo.url)));
  await prisma.item.delete({ where: { id } });
}
```

- [ ] **Step 4: Add the routes to `src/items/items.routes.ts`**

```typescript
import { updateItemBodySchema } from './items.schemas.js';
import { updateItem, deleteItem } from './items.service.js';
// ...(keep existing imports and routes)

itemsRouter.put(
  '/:id',
  requireAuth,
  requireRole('MODERATOR'),
  asyncHandler(async (req, res) => {
    const parsed = updateItemBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0].message);
    }
    const item = await updateItem(req.params.id, parsed.data);
    res.json(item);
  }),
);

itemsRouter.delete(
  '/:id',
  requireAuth,
  requireRole('MODERATOR'),
  asyncHandler(async (req, res) => {
    await deleteItem(req.params.id);
    res.status(204).send();
  }),
);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && pnpm test -- items/items.moderator-edit-delete.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/items apps/backend/test/items/items.moderator-edit-delete.test.ts
git commit -m "feat: let moderators edit and delete any item"
```

---

### Task 13: Moderation — queue, approve, reject

**Files:**
- Create: `apps/backend/src/moderation/moderation.service.ts`
- Create: `apps/backend/src/moderation/moderation.routes.ts`
- Modify: `apps/backend/src/app.ts`
- Test: `apps/backend/test/moderation/moderation.test.ts`

**Interfaces:**
- Consumes: `serializeItem` (Task 9), `requireAuth`/`requireRole` (Task 7), `ConflictError`/`ValidationError`/`NotFoundError` (Task 2).
- Produces: `getQueue(): Promise<ItemDto[]>`, `approveItem(id: string, moderatorId: string): Promise<ItemDto>`, `rejectItem(id: string, moderatorId: string, reason: string): Promise<ItemDto>` from `moderation.service.ts`. `moderationRouter` mounted at `/moderation` with `GET /moderation/queue`; `approveItem`/`rejectItem` exposed as `POST /items/:id/approve` and `POST /items/:id/reject` on `itemsRouter`.

- [ ] **Step 1: Write the failing test**

`apps/backend/test/moderation/moderation.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { resetDb } from '../helpers/db-reset.js';
import { prisma } from '../../src/db.js';
import { registerAndLogin } from '../helpers/factories.js';

const app = createApp();

async function createItem(token: string, categoryId: string) {
  const res = await request(app)
    .post('/items')
    .set('Authorization', `Bearer ${token}`)
    .field('title', 'Queue Item')
    .field('description', 'For moderation tests.')
    .field('price', '25')
    .field('condition', 'Good')
    .field('isNegotiable', 'false')
    .field('categoryId', categoryId)
    .field('options', JSON.stringify([]))
    .attach('photos', Buffer.from('fake-image-bytes'), 'item.jpg');
  return res.body;
}

describe('moderation queue, approve, reject', () => {
  beforeEach(resetDb);

  it('lists only pending items in the queue, oldest first', async () => {
    const { token: contributorToken } = await registerAndLogin(app, 'CONTRIBUTOR');
    const { token: modToken } = await registerAndLogin(app, 'MODERATOR');
    const category = await prisma.category.findFirstOrThrow();
    const first = await createItem(contributorToken, category.id);
    const second = await createItem(contributorToken, category.id);
    await prisma.item.update({ where: { id: second.id }, data: { status: 'PUBLISHED' } });

    const res = await request(app).get('/moderation/queue').set('Authorization', `Bearer ${modToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(first.id);
  });

  it('rejects a contributor from viewing the queue', async () => {
    const { token: contributorToken } = await registerAndLogin(app, 'CONTRIBUTOR');
    const res = await request(app).get('/moderation/queue').set('Authorization', `Bearer ${contributorToken}`);
    expect(res.status).toBe(403);
  });

  it('approves a pending item', async () => {
    const { token: contributorToken } = await registerAndLogin(app, 'CONTRIBUTOR');
    const { token: modToken } = await registerAndLogin(app, 'MODERATOR');
    const category = await prisma.category.findFirstOrThrow();
    const item = await createItem(contributorToken, category.id);

    const res = await request(app)
      .post(`/items/${item.id}/approve`)
      .set('Authorization', `Bearer ${modToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PUBLISHED');
    expect(res.body.reviewedById).toEqual(expect.any(String));
  });

  it('rejects approving an item that is not pending', async () => {
    const { token: contributorToken } = await registerAndLogin(app, 'CONTRIBUTOR');
    const { token: modToken } = await registerAndLogin(app, 'MODERATOR');
    const category = await prisma.category.findFirstOrThrow();
    const item = await createItem(contributorToken, category.id);
    await prisma.item.update({ where: { id: item.id }, data: { status: 'PUBLISHED' } });

    const res = await request(app)
      .post(`/items/${item.id}/approve`)
      .set('Authorization', `Bearer ${modToken}`);

    expect(res.status).toBe(409);
  });

  it('rejects a pending item with a reason', async () => {
    const { token: contributorToken } = await registerAndLogin(app, 'CONTRIBUTOR');
    const { token: modToken } = await registerAndLogin(app, 'MODERATOR');
    const category = await prisma.category.findFirstOrThrow();
    const item = await createItem(contributorToken, category.id);

    const res = await request(app)
      .post(`/items/${item.id}/reject`)
      .set('Authorization', `Bearer ${modToken}`)
      .send({ reason: 'Photos do not match the description' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('REJECTED');
    expect(res.body.rejectionReason).toBe('Photos do not match the description');
  });

  it('requires a reason to reject', async () => {
    const { token: contributorToken } = await registerAndLogin(app, 'CONTRIBUTOR');
    const { token: modToken } = await registerAndLogin(app, 'MODERATOR');
    const category = await prisma.category.findFirstOrThrow();
    const item = await createItem(contributorToken, category.id);

    const res = await request(app)
      .post(`/items/${item.id}/reject`)
      .set('Authorization', `Bearer ${modToken}`)
      .send({});

    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && pnpm test -- moderation/moderation.test.ts`
Expected: FAIL — routes not mounted.

- [ ] **Step 3: Write `src/moderation/moderation.service.ts`**

```typescript
import { prisma } from '../db.js';
import { serializeItem } from '../items/items.serialize.js';
import { NotFoundError, ConflictError } from '../errors.js';

export async function getQueue() {
  const items = await prisma.item.findMany({
    where: { status: 'PENDING' },
    include: { photos: true },
    orderBy: { createdAt: 'asc' },
  });
  return items.map(serializeItem);
}

export async function approveItem(id: string, moderatorId: string) {
  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) {
    throw new NotFoundError('Item not found');
  }
  if (item.status !== 'PENDING') {
    throw new ConflictError(`Cannot approve an item with status ${item.status}`);
  }

  const updated = await prisma.item.update({
    where: { id },
    data: {
      status: 'PUBLISHED',
      reviewedById: moderatorId,
      reviewedAt: new Date(),
      statusEvents: {
        create: { actorId: moderatorId, fromStatus: 'PENDING', toStatus: 'PUBLISHED' },
      },
    },
    include: { photos: true },
  });

  return serializeItem(updated);
}

export async function rejectItem(id: string, moderatorId: string, reason: string) {
  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) {
    throw new NotFoundError('Item not found');
  }
  if (item.status !== 'PENDING') {
    throw new ConflictError(`Cannot reject an item with status ${item.status}`);
  }

  const updated = await prisma.item.update({
    where: { id },
    data: {
      status: 'REJECTED',
      reviewedById: moderatorId,
      reviewedAt: new Date(),
      rejectionReason: reason,
      statusEvents: {
        create: { actorId: moderatorId, fromStatus: 'PENDING', toStatus: 'REJECTED', reason },
      },
    },
    include: { photos: true },
  });

  return serializeItem(updated);
}
```

- [ ] **Step 4: Write `src/moderation/moderation.routes.ts`**

```typescript
import { Router } from 'express';
import { asyncHandler } from '../app.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getQueue } from './moderation.service.js';

export const moderationRouter = Router();

moderationRouter.get(
  '/queue',
  requireAuth,
  requireRole('MODERATOR'),
  asyncHandler(async (_req, res) => {
    const items = await getQueue();
    res.json(items);
  }),
);
```

- [ ] **Step 5: Add approve/reject routes to `src/items/items.routes.ts`**

```typescript
import { z } from 'zod';
import { approveItem, rejectItem } from '../moderation/moderation.service.js';
// ...(keep existing imports and routes)

const rejectBodySchema = z.object({ reason: z.string().min(1) });

itemsRouter.post(
  '/:id/approve',
  requireAuth,
  requireRole('MODERATOR'),
  asyncHandler(async (req, res) => {
    const item = await approveItem(req.params.id, req.user!.id);
    res.json(item);
  }),
);

itemsRouter.post(
  '/:id/reject',
  requireAuth,
  requireRole('MODERATOR'),
  asyncHandler(async (req, res) => {
    const parsed = rejectBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0].message);
    }
    const item = await rejectItem(req.params.id, req.user!.id, parsed.data.reason);
    res.json(item);
  }),
);
```

- [ ] **Step 6: Mount `moderationRouter` in `src/app.ts`**

```typescript
import { moderationRouter } from './moderation/moderation.routes.js';
// ...inside createApp():
app.use('/moderation', moderationRouter);
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd apps/backend && pnpm test -- moderation/moderation.test.ts`
Expected: PASS

- [ ] **Step 8: Run the full test suite**

Run: `cd apps/backend && pnpm test`
Expected: all test files pass.

- [ ] **Step 9: Commit**

```bash
git add apps/backend/src/moderation apps/backend/src/items/items.routes.ts apps/backend/src/app.ts apps/backend/test/moderation
git commit -m "feat: add moderation queue, approve, and reject endpoints"
```

---

## Self-Review Notes

- **Spec coverage:** users/roles ✓ (Task 6/7), categories ✓ (Task 8), item create with photos/conditional min-price/options ✓ (Task 9), public catalog + detail with published-only visibility ✓ (Task 10), moderator full visibility ✓ (Task 10), contributor cancel ✓ (Task 11), moderator edit/delete ✓ (Task 12), moderation queue/approve/reject with status_events audit trail ✓ (Task 9/11/13), storage abstraction ✓ (Task 4). AI features and frontend are explicitly out of scope for this plan (separate plans).
- **Type consistency:** `ItemDto` (Task 9) is reused unchanged through Tasks 10–13; `Role`/`ItemStatus` enum values (`CONTRIBUTOR`/`MODERATOR`, `PENDING`/`PUBLISHED`/`REJECTED`/`CANCELLED`) are consistent across schema, middleware, and every service function.
- **Known follow-up for the deployment plan:** `createStorage` currently throws for `STORAGE_DRIVER=s3` — the deployment plan adds `S3Storage` and wires the real driver selection for the deployed environment.
