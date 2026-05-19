import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { drizzle } from 'drizzle-orm/node-sqlite';

import * as schema from './schema';

declare global {
  var __socialPracticeDatabaseFile: string | undefined;
}

const defaultDatabaseFile = 'backend/data/app.db';
const databaseFile = path.resolve(globalThis.__socialPracticeDatabaseFile ?? defaultDatabaseFile);

fs.mkdirSync(path.dirname(databaseFile), { recursive: true });

export const sqlite = new DatabaseSync(databaseFile);
sqlite.exec('PRAGMA journal_mode = WAL');
sqlite.exec('PRAGMA foreign_keys = ON');

export const db = drizzle({ client: sqlite, schema });
export { databaseFile };
