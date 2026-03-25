import { Elysia, t } from 'elysia';

import { hashPassword } from '../auth/password';
import { parseUserImportCsvBuffer, parseUserImportCsvText, type CsvUserImportEntry } from '../csv/user-import';
import database from '../database';
import {
  apiError,
  assignmentBodySchema,
  asRequiredString,
  batchDeleteUsersBodySchema,
  batchResetPasswordBodySchema,
  createUserResultSchema,
  idParamSchema,
  requireRole,
  roleQuerySchema,
  updateUserBodySchema,
  userRoleSchema
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
  file: t.File({
    maxSize: '50m'
  })
});

export const adminRoutes = new Elysia({ prefix: '/admin' })
  .use(authPlugin)
  .guard({
    beforeHandle: ({ user, authError }) => requireRole(user, authError, ['admin'])
  })
  .post('/users', async ({ body }) => {
    const name = asRequiredString(body.name);
    const role = body.role;
    const teacherUid = typeof body.teacher_uid === 'string' ? body.teacher_uid.trim() : '';

    if (!name) {
      return apiError(400, '姓名不能为空。');
    }

    let teacherId: number | null = null;
    if (teacherUid) {
      if (role !== 'student') {
        return apiError(400, '非学生不能分配管理老师。');
      }

      const teacher = database.findUserByUid(teacherUid);
      if (!teacher || teacher.role !== 'teacher') {
        return apiError(400, '指定的教师 UID 无效或不存在。');
      }

      teacherId = teacher.id;
    }

    const result = await database.createUser(name, role);
    if (teacherId && result.role === 'student') {
      database.assignStudentsToTeacher(teacherId, [result.id]);
    }

    return {
      message: '用户创建成功。',
      user: result
    };
  }, {
    body: createUserBodySchema
  })
  .post('/users/batch', async ({ body }) => {
    const validated: Array<{ name: string; role: 'admin' | 'teacher' | 'student'; teacherId: number | null }> = [];

    for (let index = 0; index < body.entries.length; index += 1) {
      const entry = body.entries[index];
      const name = asRequiredString(entry.name);
      const teacherUid = typeof entry.teacher_uid === 'string' ? entry.teacher_uid.trim() : '';

      if (!name) {
        return apiError(400, `第 ${index + 1} 行姓名为空。`);
      }

      let teacherId: number | null = null;
      if (teacherUid) {
        if (entry.role !== 'student') {
          return apiError(400, `第 ${index + 1} 行错误：非学生不能分配管理老师。`);
        }

        const teacher = database.findUserByUid(teacherUid);
        if (!teacher || teacher.role !== 'teacher') {
          return apiError(400, `第 ${index + 1} 行错误：指定的教师 UID ${teacherUid} 无效或不存在。`);
        }

        teacherId = teacher.id;
      }

      validated.push({ name, role: entry.role, teacherId });
    }

    const results = await database.createUsers(validated.map((item) => ({ name: item.name, role: item.role })));

    for (let index = 0; index < results.length; index += 1) {
      if (validated[index].teacherId && results[index].role === 'student') {
        database.assignStudentsToTeacher(validated[index].teacherId!, [results[index].id]);
      }
    }

    return {
      message: `成功创建 ${results.length} 个用户。`,
      users: results
    };
  }, {
    body: batchCreateUsersBodySchema
  })
  .post('/users/import/preview', async ({ body }) => {
    try {
      const parsed = await readUserImportCsv(body.file);
      const validatedEntries = validateCsvImportEntries(parsed.entries);

      return {
        message: `成功识别 ${parsed.totalCount} 条导入记录。`,
        encoding: parsed.encoding,
        totalCount: parsed.totalCount,
        studentCount: parsed.studentCount,
        entries: validatedEntries.map((entry) => ({
          lineNumber: entry.lineNumber,
          name: entry.name,
          role: entry.role,
          teacher_uid: entry.teacher_uid
        }))
      };
    } catch (error) {
      return apiError(400, error instanceof Error ? error.message : 'CSV 文件无效。');
    }
  }, {
    body: csvFileBodySchema
  })
  .post('/users/import', async ({ body }) => {
    try {
      const parsed = await readUserImportCsv(body.file);
      const validated = validateCsvImportEntries(parsed.entries);
      const results = await database.createUsers(validated.map((entry) => ({ name: entry.name, role: entry.role })));

      for (let index = 0; index < results.length; index += 1) {
        if (validated[index].teacherId && results[index].role === 'student') {
          database.assignStudentsToTeacher(validated[index].teacherId!, [results[index].id]);
        }
      }

      return {
        message: `成功导入 ${results.length} 个用户。`,
        encoding: parsed.encoding,
        users: results
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'CSV 导入失败。';
      const statusCode = message.includes('失败') ? 500 : 400;
      return apiError(statusCode, message);
    }
  }, {
    body: csvFileBodySchema
  })
  .get('/users', ({ query }) => {
    const users = database.getUsersByRole(query.role);
    return { users };
  }, {
    query: roleQuerySchema
  })
  .put('/users/:id', async ({ params, body }) => {
    const userId = Number(params.id);
    const user = database.findUserById(userId);

    if (!user) {
      return apiError(404, '用户不存在。');
    }

    const name = body.name === undefined ? undefined : asRequiredString(body.name);
    const newPassword = typeof body.password === 'string' ? body.password : '';

    if (body.name !== undefined && !name) {
      return apiError(400, '姓名不能为空。');
    }

    if (name) {
      database.updateUserName(userId, name);
    }

    if (newPassword) {
      if (newPassword.length < 8) {
        return apiError(400, '密码至少需要 8 位。');
      }

      database.updateUserPassword(userId, await hashPassword(newPassword));
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
    const userId = Number(params.id);

    if (userId === user!.id) {
      return apiError(400, '不能删除自己的账号。');
    }

    if (!database.deleteUser(userId)) {
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

async function readUserImportCsv(file: File) {
  if (!file.name.toLowerCase().endsWith('.csv')) {
    throw new Error('请上传 .csv 文件。');
  }

  return parseUserImportCsvBuffer(new Uint8Array(await file.arrayBuffer()), { columnCount: 3 });
}

function validateCsvImportEntries(entries: CsvUserImportEntry[]) {
  return entries.map((entry) => {
    let teacherId: number | null = null;
    const teacherUid = entry.teacher_uid.trim();

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
      ...entry,
      teacher_uid: teacherUid,
      teacherId
    };
  });
}
