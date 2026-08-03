// Explicitly load apps/backend/.env before any test file's module graph
// evaluates, so tests that read real environment variables (e.g. DATABASE_URL
// for the shared test Postgres) have a sane fallback whether or not that
// currently happens to work as a side effect of some other import (it
// shouldn't rely on one — see src/server.ts for the same explicit load used
// at runtime). If no .env file exists on disk, dotenv/config is a no-op here
// and tests that stub process.env themselves (health.test.ts,
// middleware/auth.test.ts, auth/jwt.test.ts) are unaffected either way, since
// they override the relevant keys in their own beforeEach.
import 'dotenv/config';
