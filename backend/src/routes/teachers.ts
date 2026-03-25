import { Elysia, t } from 'elysia';

import { hashPassword } from '../auth/password';
import database from '../database';
import {
  apiError,
  asOptionalString,
  asRequiredString,
  batchResetPasswordBodySchema,
  batchReviewBodySchema,
  checkDate,
  checkTeacherDuration,
  idParamSchema,
  isValidUploadPath,
  normalizeRecordFilters,
  recordQuerySchema,
  requireRole,
  reviewRecordBodySchema,
  teacherRecordSchema,
  updateRecordBodySchema,
  updateUserBodySchema,
  validateRecordFilters
} from '../http';
import { authPlugin } from '../plugins/auth';
import type { RecordFilters, UpdateRecordInput, UserRole } from '../models';

function getVisibleStudentIds(userId: number, role: UserRole): Set<number> | undefined {
  if (role === 'admin') {
    return undefined;
  }

  return new Set(database.getTeacherStudents(userId).map((student) => student.id));
}

function canManageStudent(studentId: number, userId: number, role: UserRole) {
  if (role === 'admin') {
    return true;
  }

  return database.getTeacherStudents(userId).some((student) => student.id === studentId);
}

export const teacherRoutes = new Elysia({ prefix: '/teacher' })
  .use(authPlugin)
  .guard({
    beforeHandle: ({ user, authError }) => requireRole(user, authError, ['teacher', 'admin'])
  })
  .get('/records', ({ query, user }) => {
    const validationMessage = validateRecordFilters(query);
    if (validationMessage) {
      return apiError(400, validationMessage);
    }

    const filters: RecordFilters = normalizeRecordFilters(query);
    const studentIds = getVisibleStudentIds(user!.id, user!.role);
    return {
      records: database.getAllRecords(filters, studentIds)
    };
  }, {
    query: recordQuerySchema
  })
  .get('/records/:id', ({ params, user }) => {
    const studentIds = getVisibleStudentIds(user!.id, user!.role);
    const record = database.getTeacherRecordById(Number(params.id), studentIds);

    if (!record) {
      return apiError(404, '记录不存在。');
    }

    return { record };
  }, {
    params: idParamSchema
  })
  .put('/records/:id/review', ({ params, body, user }) => {
    const comment = typeof body.comment === 'string' && body.comment.trim() ? body.comment.trim() : null;
    const studentIds = getVisibleStudentIds(user!.id, user!.role);
    const existing = database.getTeacherRecordById(Number(params.id), studentIds);

    if (!existing) {
      return apiError(404, '记录不存在。');
    }

    const updated = database.updateRecord(existing.id, {
      status: body.status,
      teacher_comment: comment
    });

    if (!updated) {
      return apiError(404, '记录不存在。');
    }

    const message = body.status === 'approved'
      ? `你的实践记录 "${updated.title}" 已被通过。`
      : body.status === 'rejected'
        ? `你的实践记录 "${updated.title}" 已被驳回。`
        : `你的实践记录 "${updated.title}" 已被退回待审核。`;

    database.createNotification(updated.student_id, body.status === 'pending' ? 'other' : body.status, message);

    return { message: '审核结果保存成功。' };
  }, {
    body: reviewRecordBodySchema,
    params: idParamSchema
  })
  .post('/records/batch-review', ({ body, user }) => {
    const studentIds = getVisibleStudentIds(user!.id, user!.role);
    let successCount = 0;

    for (const id of body.ids) {
      const record = database.getTeacherRecordById(id, studentIds);
      if (!record) {
        continue;
      }

      if (body.action === 'deleted') {
        database.deleteRecord(record.id);
        database.createNotification(record.student_id, 'deleted', `你的实践记录 "${record.title}" 已被删除。`);
      } else {
        database.updateRecord(record.id, { status: body.action, teacher_comment: null });
        const message = body.action === 'approved'
          ? `你的实践记录 "${record.title}" 已被通过。`
          : body.action === 'rejected'
            ? `你的实践记录 "${record.title}" 已被驳回。`
            : `你的实践记录 "${record.title}" 已被退回待审核。`;

        database.createNotification(record.student_id, body.action === 'pending' ? 'other' : body.action, message);
      }

      successCount += 1;
    }

    return { message: `成功处理 ${successCount} 条记录。` };
  }, {
    body: batchReviewBodySchema
  })
  .put('/records/:id', ({ params, body, user }) => {
    const studentIds = getVisibleStudentIds(user!.id, user!.role);
    const existingRecord = database.getTeacherRecordById(Number(params.id), studentIds);

    if (!existingRecord) {
      return apiError(404, '记录不存在。');
    }

    const updates: UpdateRecordInput = {
      updated_by_uid: user!.uid
    };

    if (body.title !== undefined) {
      const title = asRequiredString(body.title);
      if (!title) {
        return apiError(400, '标题不能为空。');
      }
      updates.title = title;
    }

    if (body.content !== undefined) {
      const content = asRequiredString(body.content);
      if (!content) {
        return apiError(400, '内容不能为空。');
      }
      updates.content = content;
    }

    if (body.practice_date !== undefined) {
      const practiceDate = asRequiredString(body.practice_date);
      if (!practiceDate) {
        return apiError(400, '实践日期不能为空。');
      }

      if (!checkDate(practiceDate)) {
        return apiError(400, '不能记录未来的活动。');
      }

      updates.practice_date = practiceDate;
    }

    if (body.location !== undefined) {
      updates.location = asOptionalString(body.location);
    }

    if (body.duration !== undefined) {
      const durationValue = typeof body.duration === 'number' ? body.duration : Number(body.duration);
      if (!Number.isFinite(durationValue)) {
        return apiError(400, '时长不能为空。');
      }

      if (!checkTeacherDuration(durationValue)) {
        return apiError(400, '时长过短或不是 0.1 的倍数。');
      }

      updates.duration = durationValue;
    }

    if (body.image_path !== undefined) {
      const imagePath = asOptionalString(body.image_path);
      if (imagePath && !isValidUploadPath(imagePath)) {
        return apiError(400, '图片路径无效。');
      }

      updates.image_path = imagePath;
    }

    database.updateRecord(existingRecord.id, updates);
    return { message: '记录更新成功。' };
  }, {
    body: updateRecordBodySchema,
    params: idParamSchema
  })
  .delete('/records/:id', ({ params, user }) => {
    const studentIds = getVisibleStudentIds(user!.id, user!.role);
    const existingRecord = database.getTeacherRecordById(Number(params.id), studentIds);

    if (!existingRecord) {
      return apiError(404, '记录不存在。');
    }

    database.deleteRecord(existingRecord.id);
    database.createNotification(existingRecord.student_id, 'deleted', `你的实践记录 "${existingRecord.title}" 已被删除。`);
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

    const name = body.name === undefined ? undefined : asRequiredString(body.name);
    const newPassword = typeof body.password === 'string' ? body.password : '';

    if (body.name !== undefined && !name) {
      return apiError(400, '姓名不能为空。');
    }

    if (name) {
      database.updateUserName(studentId, name);
    }

    if (newPassword) {
      if (newPassword.length < 8) {
        return apiError(400, '密码至少需要 8 位。');
      }

      database.updateUserPassword(studentId, await hashPassword(newPassword));
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
  .get('/statistics', ({ user }) => {
    const studentIds = getVisibleStudentIds(user!.id, user!.role);
    return {
      statistics: database.getStatistics(studentIds)
    };
  });
