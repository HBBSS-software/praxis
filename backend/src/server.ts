import { serve } from '@hono/node-server';

import { app } from './app.js';
import { appConfig } from './config.js';
import database from './database.js';

const port = appConfig.port;
const hostname = appConfig.backend_host;

database.startTempUploadCleanupWorker();

serve({
  fetch: app.fetch,
  port,
  hostname
});

console.log(`Server listening on http://${hostname}:${port}`);
