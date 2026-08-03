import { createApp } from './app.js';
import { loadEnv } from './env.js';

const env = loadEnv();
const app = createApp();

app.listen(env.port, () => {
  console.log(`Reloop backend listening on port ${env.port}`);
});
