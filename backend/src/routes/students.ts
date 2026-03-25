import { Elysia } from 'elysia';

import database from '../database';
import {
  apiError,
  asOptionalString,
  asRequiredString,
  checkDate,
  checkStudentDuration,
  createRecordBodySchema,
  idParamSchema,
  isValidUploadPath,
  requireRole,
  updateRecordBodySchema
} from '../http';
import { authPlugin } from '../plugins/auth';
import type { UpdateRecordInput } from '../models';

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
    const title = asRequiredString(body.title);
    const content = asRequiredString(body.content);
    const practiceDate = asRequiredString(body.practice_date);
    const durationValue = typeof body.duration === 'number' ? body.duration : Number(body.duration);

    if (!title || !content || !practiceDate || !Number.isFinite(durationValue)) {
      return apiError(400, '标题、内容、实践日期和时长不能为空。');
    }

    if (!checkDate(practiceDate)) {
      return apiError(400, '不能记录未来的活动。');
    }

    if (!checkStudentDuration(durationValue)) {
      return apiError(400, '时长过短。');
    }

    const imagePath = asOptionalString(body.image_path);
    if (imagePath && !isValidUploadPath(imagePath)) {
      return apiError(400, '图片路径无效。');
    }

    const todayCount = database.countStudentRecordsToday(user!.id);
    if (todayCount >= database.MAX_DAILY_RECORDS) {
      return apiError(429, `每天最多创建 ${database.MAX_DAILY_RECORDS} 条实践记录。`);
    }

    const record = database.createRecord({
      student_id: user!.id,
      title,
      content,
      practice_date: practiceDate,
      location: asOptionalString(body.location),
      duration: durationValue,
      image_path: imagePath
    });

    return {
      message: '记录创建成功。',
      recordId: record.id
    };
  }, {
    body: createRecordBodySchema
  })
  .put('/records/:id', ({ params, body, user }) => {
    const existingRecord = database.getRecordById(Number(params.id));

    if (!existingRecord || existingRecord.student_id !== user!.id) {
      return apiError(404, '记录不存在。');
    }

    if (existingRecord.status !== 'pending' && existingRecord.status !== 'rejected') {
      return apiError(403, '只能修改待审核或已驳回的记录。');
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

      if (!checkStudentDuration(durationValue)) {
        return apiError(400, '时长过短。');
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
    const existingRecord = database.getRecordById(Number(params.id));

    if (!existingRecord || existingRecord.student_id !== user!.id) {
      return apiError(404, '记录不存在。');
    }

    if (existingRecord.status !== 'pending') {
      return apiError(403, '只能删除待审核的记录。');
    }

    database.deleteRecord(existingRecord.id);
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
