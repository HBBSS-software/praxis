import { Elysia, t } from 'elysia';

import { hashPassword } from '../auth/password';
import { parseUserImportCsvBuffer, type CsvUserImportEntry } from '../csv/user-import';
import database from '../database';
import {
  apiError,
  assignmentBodySchema,
  batchDeleteUsersBodySchema,
  batchResetPasswordBodySchema,
  idParamSchema,
  requireRole,
  roleQuerySchema,
  updateUserBodySchema,
  userRoleSchema,
  validateName,
  validatePassword
} from '../http';
import { authPlugin } from '../plugins/auth';

const createUserBodySchema = t.Object({
  name: t.String(),
  role: userRoleSchema,
  teacher_uid: t.Optional(t.String())
});

const batchCreateUsersBodySchema = t.Object({
  entries: t.Array(createUserBodySchema, { minItems: 1 })
});

const csvFileBodySchema = t.Object({
  file: t.File({ maxSize: '50m' })
});

function resolveTeacherId(role: 'admin' | 'teacher' | 'student', teacherUid: string) {
  if (!teacherUid) {
    return null;
  }

  if (role !== 'student') {
    throw new Error('非学生不能分配管理老师。');
  }

  const teacher = database.findUserByUid(teacherUid);

  if (!teacher || teacher.role !== 'teacher') {
    throw new Error(`指定的教师 UID ${teacherUid} 无效或不存在。`);
  }

  return teacher.id;
}

async function readImportFile(file: File) {
  if (!file.name.toLowerCase().endsWith('.csv')) {
    throw new Error('请上传 .csv 文件。');
  }

  return parseUserImportCsvBuffer(new Uint8Array(await file.arrayBuffer()), { columnCount: 3 });
}

function validateImportEntries(entries: CsvUserImportEntry[]) {
  return entries.map((entry) => {
    const nameError = validateName(entry.name);

    if (nameError) {
      throw new Error(`第 ${entry.lineNumber} 行错误：${nameError}`);
    }

    const teacherUid = entry.teacher_uid.trim();
    let teacherId: number | null = null;

    if (teacherUid) {
      if (entry.role !== 'student') {
        throw new Error(`第 ${entry.lineNumber} 行错误：非学生不能分配管理老师。`);
      }

      const teacher = database.findUserByUid(teacherUid);

      if (!teacher || teacher.role !== 'teacher') {
        throw new Error(`第 ${entry.lineNumber} 行错误：指定的教师 UID ${teacherUid} 无效或不存在。`);
      }

      teacherId = teacher.id;
    }

    return {
      lineNumber: entry.lineNumber,
      name: entry.name.trim(),
      role: entry.role,
      teacher_uid: teacherUid,
      teacherId
    };
  });
}

export const adminRoutes = new Elysia({ prefix: '/admin' })
  .use(authPlugin)
  .guard({
    beforeHandle: ({ user, authError }) => requireRole(user, authError, ['admin'])
  })
  .post('/users', async ({ body }) => {
    const nameError = validateName(body.name);

    if (nameError) {
      return apiError(400, nameError);
    }

    const teacherUid = body.teacher_uid?.trim() ?? '';
    let teacherId: number | null;

    try {
      teacherId = resolveTeacherId(body.role, teacherUid);
    } catch (error) {
      return apiError(400, error instanceof Error ? error.message : '教师信息无效。');
    }

    const user = await database.createUser(body.name.trim(), body.role);

    if (teacherId && user.role === 'student') {
      database.assignStudentsToTeacher(teacherId, [user.id]);
    }

    return {
      message: '用户创建成功。',
      user
    };
  }, {
    body: createUserBodySchema
  })
  .post('/users/batch', async ({ body }) => {
    const normalized: Array<{ name: string; role: 'admin' | 'teacher' | 'student'; teacherId: number | null }> = [];

    for (let index = 0; index < body.entries.length; index += 1) {
      const entry = body.entries[index];
      const nameError = validateName(entry.name);

      if (nameError) {
        return apiError(400, `第 ${index + 1} 行错误：${nameError}`);
      }

      try {
        normalized.push({
          name: entry.name.trim(),
          role: entry.role,
          teacherId: resolveTeacherId(entry.role, entry.teacher_uid?.trim() ?? '')
        });
      } catch (error) {
        return apiError(400, `第 ${index + 1} 行错误：${error instanceof Error ? error.message : '教师信息无效。'}`);
      }
    }

    const users = await database.createUsers(normalized.map(({ name, role }) => ({ name, role })));

    users.forEach((user, index) => {
      if (user.role === 'student' && normalized[index].teacherId) {
        database.assignStudentsToTeacher(normalized[index].teacherId!, [user.id]);
      }
    });

    return {
      message: `成功创建 ${users.length} 个用户。`,
      users
    };
  }, {
    body: batchCreateUsersBodySchema
  })
  .post('/users/import/preview', async ({ body }) => {
    try {
      const parsed = await readImportFile(body.file);
      const entries = validateImportEntries(parsed.entries);

      return {
        message: `成功识别 ${parsed.totalCount} 条导入记录。`,
        encoding: parsed.encoding,
        totalCount: parsed.totalCount,
        studentCount: parsed.studentCount,
        entries: entries.map(({ teacherId: _teacherId, ...entry }) => entry)
      };
    } catch (error) {
      return apiError(400, error instanceof Error ? error.message : 'CSV 文件无效。');
    }
  }, {
    body: csvFileBodySchema
  })
  .post('/users/import', async ({ body }) => {
    try {
      const parsed = await readImportFile(body.file);
      const entries = validateImportEntries(parsed.entries);
      const users = await database.createUsers(entries.map(({ name, role }) => ({ name, role })));

      users.forEach((user, index) => {
        if (user.role === 'student' && entries[index].teacherId) {
          database.assignStudentsToTeacher(entries[index].teacherId!, [user.id]);
        }
      });

      return {
        message: `成功导入 ${users.length} 个用户。`,
        encoding: parsed.encoding,
        users
      };
    } catch (error) {
      return apiError(400, error instanceof Error ? error.message : 'CSV 导入失败。');
    }
  }, {
    body: csvFileBodySchema
  })
  .get('/users', ({ query }) => ({
    users: database.getUsersByRole(query.role)
  }), {
    query: roleQuerySchema
  })
  .put('/users/:id', async ({ params, body }) => {
    const user = database.findUserById(Number(params.id));

    if (!user) {
      return apiError(404, '用户不存在。');
    }

    if (body.name !== undefined) {
      const error = validateName(body.name);
      if (error) return apiError(400, error);
      database.updateUserName(user.id, body.name.trim());
    }

    if (body.password !== undefined && body.password !== '') {
      const error = validatePassword(body.password);
      if (error) return apiError(400, error);
      database.updateUserPassword(user.id, await hashPassword(body.password));
    }

    return { message: '用户信息更新成功。' };
  }, {
    body: updateUserBodySchema,
    params: idParamSchema
  })
  .patch('/users/password', async ({ body }) => {
    const users = await database.resetUserPasswords(body.ids);

    return {
      message: `成功重置 ${users.length} 个用户的密码。`,
      users
    };
  }, {
    body: batchResetPasswordBodySchema
  })
  .delete('/users', ({ body, user }) => {
    if (body.ids.includes(user!.id)) {
      return apiError(400, '不能删除自己的账号。');
    }

    let successCount = 0;

    for (const id of body.ids) {
      if (database.deleteUser(id)) {
        successCount += 1;
      }
    }

    return { message: `成功删除 ${successCount} 个用户。` };
  }, {
    body: batchDeleteUsersBodySchema
  })
  .delete('/users/:id', ({ params, user }) => {
    const id = Number(params.id);

    if (id === user!.id) {
      return apiError(400, '不能删除自己的账号。');
    }

    if (!database.deleteUser(id)) {
      return apiError(404, '用户不存在。');
    }

    return { message: '用户删除成功。' };
  }, {
    params: idParamSchema
  })
  .get('/assignments', () => ({
    assignments: database.getAllAssignments(),
    teachers: database.getUsersByRole('teacher'),
    students: database.getAllStudents()
  }))
  .post('/assignments', ({ body }) => {
    const teacher = database.findUserById(body.teacher_id);

    if (!teacher || teacher.role !== 'teacher') {
      return apiError(404, '教师不存在。');
    }

    const invalidStudentIds = body.student_ids.filter((id) => {
      const student = database.findUserById(id);
      return !student || student.role !== 'student';
    });

    if (invalidStudentIds.length > 0) {
      return apiError(400, '分配列表中存在无效学生。');
    }

    database.assignStudentsToTeacher(body.teacher_id, body.student_ids);
    return { message: '分配关系更新成功。' };
  }, {
    body: assignmentBodySchema
  })
  .delete('/assignments', ({ body }) => {
    const teacher = database.findUserById(body.teacher_id);

    if (!teacher || teacher.role !== 'teacher') {
      return apiError(404, '教师不存在。');
    }

    const invalidStudentIds = body.student_ids.filter((id) => {
      const student = database.findUserById(id);
      return !student || student.role !== 'student';
    });

    if (invalidStudentIds.length > 0) {
      return apiError(400, '分配列表中存在无效学生。');
    }

    database.removeStudentsFromTeacher(body.teacher_id, body.student_ids);
    return { message: '分配关系删除成功。' };
  }, {
    body: assignmentBodySchema
  });
