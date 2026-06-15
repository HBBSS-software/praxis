import { databaseFile, sqlite } from '../src/db/client.js';
import { ensureDatabaseSchema } from '../src/db/setup.js';

ensureDatabaseSchema();

console.log(`SQLite schema is ready: ${databaseFile}`);

sqlite.close();
