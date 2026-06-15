import { sqlite } from '../src/db/client.js';
import { ensureDatabaseSchema } from '../src/db/setup.js';
import { getPinyinInitials } from '../src/pinyin.js';

ensureDatabaseSchema();

const rows = sqlite.prepare('select id, name from users').all() as Array<{ id: number; name: string }>;
const update = sqlite.prepare('update users set name_initials = ? where id = ?');

sqlite.exec('begin');
try {
  for (const row of rows) {
    update.run(getPinyinInitials(row.name), row.id);
  }

  sqlite.exec('commit');
} catch (error) {
  sqlite.exec('rollback');
  throw error;
}

sqlite.exec('create index if not exists users_name_initials_idx on users(name_initials)');
console.log(`Updated name initials for ${rows.length} users.`);

sqlite.close();
