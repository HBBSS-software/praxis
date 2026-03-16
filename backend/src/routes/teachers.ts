import { Router } from 'express';

import database from '../database';
import { authMiddleware, teacherOnly } from '../middleware/auth';

const router = Router();

router.get('/records', authMiddleware, teacherOnly, (request, response) => {
  try {
    const records = database.getAllRecords({
      student_id: typeof request.query.student_id === 'string' ? request.query.student_id : null,
      status: typeof request.query.status === 'string' ? request.query.status : null
    });

    response.json({ records });
  } catch (error) {
    console.error('Failed to load teacher records.', error);
    response.status(500).json({ error: 'Failed to load records.' });
  }
});

router.get('/records/:id', authMiddleware, teacherOnly, (request, response) => {
  try {
    const record = database.getTeacherRecordById(Number(request.params.id));

    if (!record) {
      response.status(404).json({ error: 'Record not found.' });
      return;
    }

    response.json({ record });
  } catch (error) {
    console.error('Failed to load record detail.', error);
    response.status(500).json({ error: 'Failed to load record.' });
  }
});

router.get('/students', authMiddleware, teacherOnly, (_request, response) => {
  try {
    const students = database.getAllStudents();
    response.json({ students });
  } catch (error) {
    console.error('Failed to load students.', error);
    response.status(500).json({ error: 'Failed to load students.' });
  }
});

router.get('/students/:id/records', authMiddleware, teacherOnly, (request, response) => {
  try {
    const records = database.getRecordsByStudent(Number(request.params.id));
    response.json({ records });
  } catch (error) {
    console.error('Failed to load student detail records.', error);
    response.status(500).json({ error: 'Failed to load records.' });
  }
});

router.put('/records/:id/review', authMiddleware, teacherOnly, (request, response) => {
  const status = request.body.status;
  const comment =
    typeof request.body.comment === 'string' && request.body.comment.trim()
      ? request.body.comment.trim()
      : null;

  if (status !== 'approved' && status !== 'rejected') {
    response.status(400).json({ error: 'status must be approved or rejected.' });
    return;
  }

  try {
    const updatedRecord = database.updateRecord(Number(request.params.id), {
      status,
      teacher_comment: comment
    });

    if (!updatedRecord) {
      response.status(404).json({ error: 'Record not found.' });
      return;
    }

    response.json({ message: 'Review saved successfully.' });
  } catch (error) {
    console.error('Failed to review record.', error);
    response.status(500).json({ error: 'Failed to review record.' });
  }
});

router.get('/statistics', authMiddleware, teacherOnly, (_request, response) => {
  try {
    response.json({ statistics: database.getStatistics() });
  } catch (error) {
    console.error('Failed to load statistics.', error);
    response.status(500).json({ error: 'Failed to load statistics.' });
  }
});

export default router;
