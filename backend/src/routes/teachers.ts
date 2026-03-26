import { Elysia } from 'elysia';

import { hashPassword } from '../auth/password';
import database from '../database';
import {
  apiError,
  batchResetPasswordBodySchema,
  batchReviewBodySchema,
  buildReviewNotificationMessage,
  idParamSchema,
  isValidUploadPath,
  normalizeOptionalString,
  normalizeRecordFilters,
  parseDuration,
  recordQuerySchema,
  requireRole,
  reviewRecordBodySchema,
  updateRecordBodySchema,
  updateUserBodySchema,
  validateComment,
  validateContent,
  validateDuration,
  validateLocation,
  validateName,
  validatePassword,
  validatePracticeDate,
  validateRecordFilters,
  validateTitle
} from '../http';
import { authPlugin } from '../plugins/auth';
import type { RecordFilters, UpdateRecordInput, UserRole } from '../models';

function getVisibleStudentIds(userId: number, role: UserRole) {
  if (role === 'admin') {
    return undefined;
  }

  return new Set(database.getTeacherStudentIds(userId));
}

function canManageStudent(studentId: number, userId: number, role: UserRole) {
  if (role === 'admin') {
    return true;
  }

  return database.getTeacherStudentIds(userId).includes(studentId);
}

function parseRecordFilters(query: Record<string, unknown>): RecordFilters {
  return normalizeRecordFilters({
    student_id: typeof query.student_id === 'string' ? Number(query.student_id) : null,
    teacher_id: typeof query.teacher_id === 'string' ? Number(query.teacher_id) : null,
    status: typeof query.status === 'string' ? query.status as RecordFilters['status'] : null,
    practice_after: typeof query.practice_after === 'string' && query.practice_after ? query.practice_after : null,
    practice_before: typeof query.practice_before === 'string' && query.practice_before ? query.practice_before : null,
    created_after: typeof query.created_after === 'string' && query.created_after ? query.created_after : null,
    created_before: typeof query.created_before === 'string' && query.created_before ? query.created_before : null,
    updated_after: typeof query.updated_after === 'string' && query.updated_after ? query.updated_after : null,
    updated_before: typeof query.updated_before === 'string' && query.updated_before ? query.updated_before : null
  });
}

export const teacherRoutes = new Elysia({ prefix: '/teacher' })
  .use(authPlugin)
  .guard({
    beforeHandle: ({ user, authError }) => requireRole(user, authError, ['teacher', 'admin'])
  })
  .get('/records', ({ query, user }) => {
    const filterError = validateRecordFilters(query as Record<string, unknown>);

    if (filterError) {
      return apiError(400, filterError);
    }

    return {
      records: database.getAllRecords(parseRecordFilters(query as Record<string, unknown>), getVisibleStudentIds(user!.id, user!.role))
    };
  }, {
    query: recordQuerySchema
  })
  .get('/records/:id', ({ params, user }) => {
    const record = database.getTeacherRecordById(Number(params.id), getVisibleStudentIds(user!.id, user!.role));

    if (!record) {
      return apiError(404, '记录不存在。');
    }

    return { record };
  }, {
    params: idParamSchema
  })
  .put('/records/:id/review', ({ params, body, user }) => {
    const record = database.getTeacherRecordById(Number(params.id), getVisibleStudentIds(user!.id, user!.role));

    if (!record) {
      return apiError(404, '记录不存在。');
    }

    const comment = normalizeOptionalString(body.comment);
    const commentError = validateComment(comment);

    if (commentError) {
      return apiError(400, commentError);
    }

    const updated = database.updateRecord(record.id, {
      status: body.status,
      teacher_comment: comment,
      updated_by_uid: user!.uid
    });

    if (!updated) {
      return apiError(404, '记录不存在。');
    }

    database.createNotification(
      updated.student_id,
      body.status === 'pending' ? 'other' : body.status,
      buildReviewNotificationMessage(updated.title, body.status)
    );

    return { message: '审核结果保存成功。' };
  }, {
    body: reviewRecordBodySchema,
    params: idParamSchema
  })
  .post('/records/batch-review', ({ body, user }) => {
    const visibleStudentIds = getVisibleStudentIds(user!.id, user!.role);
    let successCount = 0;

    for (const id of body.ids) {
      const record = database.getTeacherRecordById(id, visibleStudentIds);

      if (!record) {
        continue;
      }

      if (body.action === 'deleted') {
        database.deleteRecord(record.id);
        database.createNotification(record.student_id, 'deleted', `你的实践记录 "${record.title}" 已被删除。`);
      } else {
        database.updateRecord(record.id, {
          status: body.action,
          teacher_comment: null,
          updated_by_uid: user!.uid
        });
        database.createNotification(
          record.student_id,
          body.action === 'pending' ? 'other' : body.action,
          buildReviewNotificationMessage(record.title, body.action)
        );
      }

      successCount += 1;
    }

    return { message: `成功处理 ${successCount} 条记录。` };
  }, {
    body: batchReviewBodySchema
  })
  .put('/records/:id', ({ params, body, user }) => {
    const record = database.getTeacherRecordById(Number(params.id), getVisibleStudentIds(user!.id, user!.role));

    if (!record) {
      return apiError(404, '记录不存在。');
    }

    const updates: UpdateRecordInput = {
      updated_by_uid: user!.uid
    };

    if (body.title !== undefined) {
      const value = body.title.trim();
      const error = validateTitle(value);
      if (error) return apiError(400, error);
      updates.title = value;
    }

    if (body.content !== undefined) {
      const value = body.content.trim();
      const error = validateContent(value);
      if (error) return apiError(400, error);
      updates.content = value;
    }

    if (body.practice_date !== undefined) {
      const value = body.practice_date.trim();
      const error = validatePracticeDate(value);
      if (error) return apiError(400, error);
      updates.practice_date = value;
    }

    if (body.location !== undefined) {
      const value = normalizeOptionalString(body.location);
      const error = validateLocation(value);
      if (error) return apiError(400, error);
      updates.location = value;
    }

    if (body.duration !== undefined) {
      const value = parseDuration(body.duration);
      const error = validateDuration(value);
      if (error) return apiError(400, error);
      updates.duration = value;
    }

    if (body.image_path !== undefined) {
      const value = normalizeOptionalString(body.image_path);

      if (value && !isValidUploadPath(value)) {
        return apiError(400, '图片路径无效。');
      }

      updates.image_path = value;
    }

    database.updateRecord(record.id, updates);
    return { message: '记录更新成功。' };
  }, {
    body: updateRecordBodySchema,
    params: idParamSchema
  })
  .delete('/records/:id', ({ params, user }) => {
    const record = database.getTeacherRecordById(Number(params.id), getVisibleStudentIds(user!.id, user!.role));

    if (!record) {
      return apiError(404, '记录不存在。');
    }

    database.deleteRecord(record.id);
    database.createNotification(record.student_id, 'deleted', `你的实践记录 "${record.title}" 已被删除。`);
    return { message: '记录删除成功。' };
  }, {
    params: idParamSchema
  })
  .get('/students', ({ user }) => ({
    students: user!.role === 'admin'
      ? database.getAllStudents()
      : database.getTeacherStudents(user!.id)
  }))
  .get('/students/:id/records', ({ params, user }) => {
    const studentId = Number(params.id);

    if (!canManageStudent(studentId, user!.id, user!.role)) {
      return apiError(403, '无权查看该学生。');
    }

    return {
      records: database.getRecordsByStudent(studentId)
    };
  }, {
    params: idParamSchema
  })
  .put('/students/:id', async ({ params, body, user }) => {
    const studentId = Number(params.id);
    const student = database.findUserById(studentId);

    if (!student || student.role !== 'student') {
      return apiError(404, '学生不存在。');
    }

    if (!canManageStudent(studentId, user!.id, user!.role)) {
      return apiError(403, '无权管理该学生。');
    }

    if (body.name !== undefined) {
      const error = validateName(body.name);
      if (error) return apiError(400, error);
      database.updateUserName(studentId, body.name.trim());
    }

    if (body.password !== undefined && body.password !== '') {
      const error = validatePassword(body.password);
      if (error) return apiError(400, error);
      database.updateUserPassword(studentId, await hashPassword(body.password));
    }

    return { message: '学生信息更新成功。' };
  }, {
    body: updateUserBodySchema,
    params: idParamSchema
  })
  .patch('/students/password', async ({ body, user }) => {
    const ids = user!.role === 'admin'
      ? body.ids
      : body.ids.filter((id) => canManageStudent(id, user!.id, user!.role));

    if (ids.length === 0) {
      return apiError(400, '请选择至少一个可管理的学生。');
    }

    const users = await database.resetUserPasswords(ids);

    return {
      message: `成功重置 ${users.length} 个学生的密码。`,
      users
    };
  }, {
    body: batchResetPasswordBodySchema
  })
  .get('/statistics', ({ user }) => ({
    statistics: database.getStatistics(getVisibleStudentIds(user!.id, user!.role))
  }));
