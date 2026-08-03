// Explicit env loader — must be the very first import. Without this, process.env
// only got populated because @prisma/client's generated runtime happens to
// parse apps/backend/.env as a side effect of being imported (see the vendored
// dotenv call inside its runtime library), and only because src/db.ts (which
// imports @prisma/client) happened to be imported before loadEnv() ran
// anywhere. That's fragile and undocumented — load .env explicitly instead.
import 'dotenv/config';
import { createApp } from './app.js';
import { loadEnv } from './env.js';

const env = loadEnv();
const app = createApp();

app.listen(env.port, () => {
  console.log(`Reloop backend listening on port ${env.port}`);
});
