import { Router } from 'express';

import database from '../database';
import { authMiddleware, studentOnly } from '../middleware/auth';
import type { UpdateRecordInput } from '../models';

const router = Router();

function asRequiredString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function asOptionalDuration(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const duration = Number(value);
  return Number.isFinite(duration) && duration > 0 ? duration : null;
}

router.get('/records', authMiddleware, studentOnly, (request, response) => {
  try {
    const records = database.getRecordsByStudent(request.user!.id);
    response.json({ records });
  } catch (error) {
    console.error('Failed to load student records.', error);
    response.status(500).json({ error: 'Failed to load records.' });
  }
});

router.post('/records', authMiddleware, studentOnly, (request, response) => {
  const title = asRequiredString(request.body.title);
  const content = asRequiredString(request.body.content);
  const practiceDate = asRequiredString(request.body.practice_date);

  if (!title || !content || !practiceDate) {
    response.status(400).json({ error: 'title, content, and practice_date are required.' });
    return;
  }

  try {
    const record = database.createRecord({
      student_id: request.user!.id,
      title,
      content,
      practice_date: practiceDate,
      location: asOptionalString(request.body.location),
      duration: asOptionalDuration(request.body.duration),
      image_path: asOptionalString(request.body.image_path)
    });

    response.json({
      message: 'Record created successfully.',
      recordId: record.id
    });
  } catch (error) {
    console.error('Failed to create student record.', error);
    response.status(500).json({ error: 'Failed to create record.' });
  }
});

router.put('/records/:id', authMiddleware, studentOnly, (request, response) => {
  const existingRecord = database.getRecordById(Number(request.params.id));

  if (!existingRecord || existingRecord.student_id !== request.user!.id) {
    response.status(404).json({ error: 'Record not found.' });
    return;
  }

  const updates: UpdateRecordInput = {};
  const title = asRequiredString(request.body.title);
  const content = asRequiredString(request.body.content);
  const practiceDate = asRequiredString(request.body.practice_date);

  if (request.body.title !== undefined) {
    if (!title) {
      response.status(400).json({ error: 'title cannot be empty.' });
      return;
    }

    updates.title = title;
  }

  if (request.body.content !== undefined) {
    if (!content) {
      response.status(400).json({ error: 'content cannot be empty.' });
      return;
    }

    updates.content = content;
  }

  if (request.body.practice_date !== undefined) {
    if (!practiceDate) {
      response.status(400).json({ error: 'practice_date cannot be empty.' });
      return;
    }

    updates.practice_date = practiceDate;
  }

  if (request.body.location !== undefined) {
    updates.location = asOptionalString(request.body.location);
  }

  if (request.body.duration !== undefined) {
    updates.duration = asOptionalDuration(request.body.duration);
  }

  if (request.body.image_path !== undefined) {
    updates.image_path = asOptionalString(request.body.image_path);
  }

  try {
    database.updateRecord(existingRecord.id, updates);
    response.json({ message: 'Record updated successfully.' });
  } catch (error) {
    console.error('Failed to update student record.', error);
    response.status(500).json({ error: 'Failed to update record.' });
  }
});

router.delete('/records/:id', authMiddleware, studentOnly, (request, response) => {
  const existingRecord = database.getRecordById(Number(request.params.id));

  if (!existingRecord || existingRecord.student_id !== request.user!.id) {
    response.status(404).json({ error: 'Record not found.' });
    return;
  }

  try {
    database.deleteRecord(existingRecord.id);
    response.json({ message: 'Record deleted successfully.' });
  } catch (error) {
    console.error('Failed to delete student record.', error);
    response.status(500).json({ error: 'Failed to delete record.' });
  }
});

export default router;
