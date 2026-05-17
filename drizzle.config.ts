import { defineConfig } from 'drizzle-kit';

import { appConfig } from './backend/src/config';

export default defineConfig({
  dialect: 'sqlite',
  schema: './backend/src/db/schema.ts',
  out: './backend/drizzle',
  dbCredentials: {
    url: appConfig.database_file
  }
});
