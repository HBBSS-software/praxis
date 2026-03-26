import { Elysia } from 'elysia';

import database from '../database';
import {
  apiError,
  createRecordBodySchema,
  idParamSchema,
  isValidUploadPath,
  normalizeOptionalString,
  normalizeRecordFilters,
  requireRole,
  updateRecordBodySchema,
  validateContent,
  validateDuration,
  validateLocation,
  validatePracticeDate,
  validateTitle,
  parseDuration
} from '../http';
import { authPlugin } from '../plugins/auth';
import type { UpdateRecordInput } from '../models';

function buildRecordPayload(body: Record<string, unknown>) {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  const practiceDate = typeof body.practice_date === 'string' ? body.practice_date.trim() : '';
  const location = body.location === undefined ? undefined : normalizeOptionalString(body.location);
  const duration = body.duration === undefined ? undefined : parseDuration(body.duration);
  const imagePath = body.image_path === undefined ? undefined : normalizeOptionalString(body.image_path);

  return {
    title,
    content,
    practiceDate,
    location,
    duration,
    imagePath
  };
}

export const studentRoutes = new Elysia({ prefix: '/student' })
  .use(authPlugin)
  .guard({
    beforeHandle: ({ user, authError }) => requireRole(user, authError, ['student'])
  })
  .get('/records', ({ user }) => ({
    records: database.getRecordsByStudent(user!.id),
    statistics: database.getStudentStatistics(user!.id)
  }))
  .post('/records', ({ body, user }) => {
    const payload = buildRecordPayload(body as Record<string, unknown>);
    const titleError = validateTitle(payload.title);
    const contentError = validateContent(payload.content);
    const dateError = validatePracticeDate(payload.practiceDate);
    const durationError = validateDuration(payload.duration ?? Number.NaN);
    const locationError = validateLocation(payload.location ?? null);

    if (titleError) return apiError(400, titleError);
    if (contentError) return apiError(400, contentError);
    if (dateError) return apiError(400, dateError);
    if (durationError) return apiError(400, durationError);
    if (locationError) return apiError(400, locationError);

    if (payload.imagePath && !isValidUploadPath(payload.imagePath)) {
      return apiError(400, '图片路径无效。');
    }

    if (database.countStudentRecordsToday(user!.id) >= database.MAX_DAILY_RECORDS) {
      return apiError(429, `每天最多创建 ${database.MAX_DAILY_RECORDS} 条实践记录。`);
    }

    const record = database.createRecord({
      student_id: user!.id,
      title: payload.title,
      content: payload.content,
      practice_date: payload.practiceDate,
      location: payload.location ?? null,
      duration: payload.duration!,
      image_path: payload.imagePath ?? null
    });

    return {
      message: '记录创建成功。',
      recordId: record.id
    };
  }, {
    body: createRecordBodySchema
  })
  .put('/records/:id', ({ params, body, user }) => {
    const record = database.getRecordById(Number(params.id));

    if (!record || record.student_id !== user!.id) {
      return apiError(404, '记录不存在。');
    }

    if (record.status !== 'pending' && record.status !== 'rejected') {
      return apiError(403, '只能修改待审核或已驳回的记录。');
    }

    const payload = buildRecordPayload(body as Record<string, unknown>);
    const updates: UpdateRecordInput = {
      updated_by_uid: user!.uid
    };

    if (body.title !== undefined) {
      const error = validateTitle(payload.title);
      if (error) return apiError(400, error);
      updates.title = payload.title;
    }

    if (body.content !== undefined) {
      const error = validateContent(payload.content);
      if (error) return apiError(400, error);
      updates.content = payload.content;
    }

    if (body.practice_date !== undefined) {
      const error = validatePracticeDate(payload.practiceDate);
      if (error) return apiError(400, error);
      updates.practice_date = payload.practiceDate;
    }

    if (body.location !== undefined) {
      const error = validateLocation(payload.location ?? null);
      if (error) return apiError(400, error);
      updates.location = payload.location ?? null;
    }

    if (body.duration !== undefined) {
      const error = validateDuration(payload.duration ?? Number.NaN);
      if (error) return apiError(400, error);
      updates.duration = payload.duration!;
    }

    if (body.image_path !== undefined) {
      if (payload.imagePath && !isValidUploadPath(payload.imagePath)) {
        return apiError(400, '图片路径无效。');
      }

      updates.image_path = payload.imagePath ?? null;
    }

    if (record.status === 'rejected') {
      updates.status = 'pending';
      updates.teacher_comment = null;
    }

    database.updateRecord(record.id, updates);
    return { message: '记录更新成功。' };
  }, {
    body: updateRecordBodySchema,
    params: idParamSchema
  })
  .delete('/records/:id', ({ params, user }) => {
    const record = database.getRecordById(Number(params.id));

    if (!record || record.student_id !== user!.id) {
      return apiError(404, '记录不存在。');
    }

    if (record.status !== 'pending') {
      return apiError(403, '只能删除待审核的记录。');
    }

    database.deleteRecord(record.id);
    return { message: '记录删除成功。' };
  }, {
    params: idParamSchema
  })
  .get('/notifications', ({ user }) => ({
    notifications: database.getNotificationsByStudent(user!.id),
    unreadCount: database.getUnreadNotificationCount(user!.id)
  }))
  .post('/notifications/read', ({ user }) => {
    database.markNotificationsAsRead(user!.id);
    return { message: '通知已标记为已读。' };
  });
