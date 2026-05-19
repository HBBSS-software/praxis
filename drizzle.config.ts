import { defineConfig } from 'drizzle-kit';

import { databaseFile } from './backend/src/db/client';

export default defineConfig({
  dialect: 'sqlite',
  schema: './backend/src/db/schema.ts',
  out: './backend/drizzle',
  dbCredentials: {
    url: databaseFile
  }
});
