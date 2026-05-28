import { sql } from 'drizzle-orm';

import { db } from './client';

let initialized = false;

export function ensureDatabaseSchema() {
  if (initialized) {
    return;
  }

  db.run(sql`
    create table if not exists users (
      id integer primary key autoincrement,
      uid text not null unique,
      password text not null,
      role text not null,
      name text not null,
      name_initials text not null default '',
      created_at text not null,
      deleted_at text
    )
  `);

  const userColumns = db.all<{ name: string }>(sql`pragma table_info(users)`);
  if (!userColumns.some((column) => column.name === 'name_initials')) {
    db.run(sql`alter table users add column name_initials text not null default ''`);
  }

  db.run(sql`create index if not exists users_role_idx on users(role)`);
  db.run(sql`create index if not exists users_name_initials_idx on users(name_initials)`);
  db.run(sql`create index if not exists users_deleted_at_idx on users(deleted_at)`);

  db.run(sql`
    create table if not exists teacher_students (
      teacher_id integer not null references users(id) on delete cascade,
      student_id integer not null references users(id) on delete cascade,
      created_at text not null,
      primary key (teacher_id, student_id)
    )
  `);

  db.run(sql`create unique index if not exists teacher_students_student_unique on teacher_students(student_id)`);
  db.run(sql`create index if not exists teacher_students_teacher_idx on teacher_students(teacher_id)`);

  db.run(sql`
    create table if not exists classes (
      id integer primary key autoincrement,
      cid text not null unique,
      name text not null,
      created_at text not null
    )
  `);

  db.run(sql`create index if not exists classes_created_at_idx on classes(created_at)`);

  db.run(sql`
    create table if not exists class_teachers (
      class_id integer not null references classes(id) on delete cascade,
      teacher_id integer not null references users(id) on delete cascade,
      created_at text not null,
      primary key (class_id, teacher_id)
    )
  `);

  db.run(sql`create index if not exists class_teachers_class_idx on class_teachers(class_id)`);
  db.run(sql`create index if not exists class_teachers_teacher_idx on class_teachers(teacher_id)`);

  db.run(sql`
    create table if not exists class_students (
      class_id integer not null references classes(id) on delete cascade,
      student_id integer not null references users(id) on delete cascade,
      created_at text not null,
      primary key (class_id, student_id)
    )
  `);

  db.run(sql`create unique index if not exists class_students_student_unique on class_students(student_id)`);
  db.run(sql`create index if not exists class_students_class_idx on class_students(class_id)`);

  db.run(sql`
    create table if not exists practice_tasks (
      id integer primary key autoincrement,
      title text not null,
      description text,
      start_at text not null,
      end_at text not null,
      min_words integer not null default 0,
      min_images integer not null default 0,
      max_records_per_student integer not null default 1,
      created_by_id integer not null references users(id),
      created_at text not null
    )
  `);

  db.run(sql`create index if not exists practice_tasks_start_at_idx on practice_tasks(start_at)`);
  db.run(sql`create index if not exists practice_tasks_end_at_idx on practice_tasks(end_at)`);
  db.run(sql`create index if not exists practice_tasks_created_by_idx on practice_tasks(created_by_id)`);
  db.run(sql`create index if not exists practice_tasks_created_at_idx on practice_tasks(created_at)`);

  db.run(sql`
    create table if not exists practice_task_classes (
      task_id integer not null references practice_tasks(id) on delete cascade,
      class_id integer not null references classes(id) on delete cascade,
      created_at text not null,
      primary key (task_id, class_id)
    )
  `);

  db.run(sql`create index if not exists practice_task_classes_task_idx on practice_task_classes(task_id)`);
  db.run(sql`create index if not exists practice_task_classes_class_idx on practice_task_classes(class_id)`);

  db.run(sql`
    create table if not exists practice_records (
      id integer primary key autoincrement,
      task_id integer references practice_tasks(id) on delete cascade,
      student_id integer not null references users(id),
      student_uid_snapshot text,
      title text not null,
      content text not null,
      practice_date text not null,
      location text,
      duration real not null,
      image_paths text not null default '[]',
      cover_image_path text,
      status text not null,
      teacher_comment text,
      created_at text not null
    )
  `);

  const recordColumns = db.all<{ name: string }>(sql`pragma table_info(practice_records)`);
  if (!recordColumns.some((column) => column.name === 'task_id')) {
    db.run(sql`alter table practice_records add column task_id integer references practice_tasks(id) on delete cascade`);
  }

  if (!recordColumns.some((column) => column.name === 'image_paths')) {
    db.run(sql`alter table practice_records add column image_paths text not null default '[]'`);
  }

  if (!recordColumns.some((column) => column.name === 'cover_image_path')) {
    db.run(sql`alter table practice_records add column cover_image_path text`);
  }

  db.run(sql`create index if not exists practice_records_task_idx on practice_records(task_id)`);
  db.run(sql`create index if not exists practice_records_student_idx on practice_records(student_id)`);
  db.run(sql`create index if not exists practice_records_task_student_idx on practice_records(task_id, student_id)`);
  db.run(sql`create index if not exists practice_records_cover_image_path_idx on practice_records(cover_image_path)`);
  db.run(sql`create index if not exists practice_records_status_idx on practice_records(status)`);
  db.run(sql`create index if not exists practice_records_practice_date_idx on practice_records(practice_date)`);
  db.run(sql`create index if not exists practice_records_created_at_idx on practice_records(created_at)`);

  db.run(sql`
    create table if not exists notifications (
      id integer primary key autoincrement,
      student_id integer not null references users(id),
      type text not null,
      message text not null,
      is_read integer not null default 0,
      created_at text not null
    )
  `);

  db.run(sql`create index if not exists notifications_student_idx on notifications(student_id)`);
  db.run(sql`create index if not exists notifications_created_at_idx on notifications(created_at)`);

  db.run(sql`
    create table if not exists temp_upload_deletions (
      id integer primary key autoincrement,
      file_path text not null unique,
      expires_at text not null,
      created_at text not null
    )
  `);

  db.run(sql`create index if not exists temp_upload_deletions_expires_at_idx on temp_upload_deletions(expires_at)`);

  initialized = true;
}
