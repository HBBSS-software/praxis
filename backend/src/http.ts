import { status, t } from 'elysia';

import type { AuthTokenPayload, RecordFilters, RecordStatus, UserRole } from './models';

const positiveIdPattern = '^[1-9]\\d*$';
const uploadPathPattern = /^\/uploads\/[A-Za-z0-9][A-Za-z0-9._-]*$/;

export const errorResponseSchema = t.Object({
  error: t.String()
});

export const messageResponseSchema = t.Object({
  message: t.String()
});

export const userRoleSchema = t.Union([
  t.Literal('admin'),
  t.Literal('teacher'),
  t.Literal('student')
]);

export const recordStatusSchema = t.Union([
  t.Literal('approved'),
  t.Literal('pending'),
  t.Literal('rejected')
]);

export const notificationTypeSchema = t.Union([
  t.Literal('approved'),
  t.Literal('rejected'),
  t.Literal('deleted'),
  t.Literal('other')
]);

export const authUserSchema = t.Object({
  id: t.Number(),
  uid: t.String(),
  role: userRoleSchema,
  name: t.String()
});

export const studentSummarySchema = t.Object({
  id: t.Number(),
  uid: t.String(),
  name: t.String(),
  created_at: t.String()
});

export const userSummarySchema = t.Object({
  ...studentSummarySchema.properties,
  role: userRoleSchema
});

export const assignmentSchema = t.Object({
  teacher_id: t.Number(),
  student_id: t.Number()
});

export const createUserResultSchema = t.Object({
  id: t.Number(),
  uid: t.String(),
  name: t.String(),
  role: userRoleSchema,
  password: t.String()
});

export const notificationSchema = t.Object({
  id: t.Number(),
  student_id: t.Number(),
  type: notificationTypeSchema,
  message: t.String(),
  is_read: t.Boolean(),
  created_at: t.String()
});

export const practiceRecordSchema = t.Object({
  id: t.Number(),
  student_id: t.Number(),
  title: t.String(),
  content: t.String(),
  practice_date: t.String(),
  location: t.Nullable(t.String()),
  duration: t.Number(),
  image_path: t.Nullable(t.String()),
  status: recordStatusSchema,
  teacher_comment: t.Nullable(t.String()),
  created_at: t.String(),
  updated_at: t.String(),
  updated_by_uid: t.Nullable(t.String())
});

export const studentRecordSchema = t.Object({
  ...practiceRecordSchema.properties,
  student_name: t.String()
});

export const teacherRecordSchema = t.Object({
  ...studentRecordSchema.properties,
  student_uid: t.String()
});

export const recordStatisticsSchema = t.Object({
  total_records: t.Number(),
  pending_count: t.Number(),
  approved_count: t.Number(),
  rejected_count: t.Number(),
  total_duration: t.Number()
});

export const teacherStatisticsSchema = t.Object({
  ...recordStatisticsSchema.properties,
  student_count: t.Number(),
  student_durations: t.Array(
    t.Object({
      student_id: t.Number(),
      student_name: t.String(),
      student_uid: t.String(),
      total_duration: t.Number()
    })
  )
});

export const csvImportEntrySchema = t.Object({
  lineNumber: t.Number(),
  name: t.String(),
  role: userRoleSchema,
  teacher_uid: t.String()
});

export const csvImportPreviewSchema = t.Object({
  message: t.String(),
  encoding: t.Union([t.Literal('utf-8'), t.Literal('utf-16'), t.Literal('gbk')]),
  totalCount: t.Number(),
  studentCount: t.Number(),
  entries: t.Array(csvImportEntrySchema)
});

export const loginBodySchema = t.Object({
  uid: t.String(),
  password: t.String()
});

export const profileBodySchema = t.Object({
  current_password: t.String(),
  name: t.String()
});

export const passwordBodySchema = t.Object({
  current_password: t.String(),
  new_password: t.String()
});

export const idParamSchema = t.Object({
  id: t.String({ pattern: positiveIdPattern })
});

export const updateUserBodySchema = t.Object({
  name: t.Optional(t.String()),
  password: t.Optional(t.String())
});

export const batchPasswordBodySchema = t.Object({
  ids: t.Array(t.Number({ minimum: 1 }), { minItems: 1, uniqueItems: true }),
  password: t.String()
});

export const batchResetPasswordBodySchema = t.Object({
  ids: t.Array(t.Number({ minimum: 1 }), { minItems: 1, uniqueItems: true })
});

export const batchDeleteUsersBodySchema = t.Object({
  ids: t.Array(t.Number({ minimum: 1 }), { minItems: 1, uniqueItems: true })
});

export const assignmentBodySchema = t.Object({
  teacher_id: t.Number({ minimum: 1 }),
  student_ids: t.Array(t.Number({ minimum: 1 }), { minItems: 1, uniqueItems: true })
});

export const createRecordBodySchema = t.Object({
  title: t.String(),
  content: t.String(),
  practice_date: t.String(),
  location: t.Optional(t.Nullable(t.String())),
  duration: t.Union([t.String(), t.Number()]),
  image_path: t.Optional(t.Nullable(t.String()))
});

export const updateRecordBodySchema = t.Object({
  title: t.Optional(t.String()),
  content: t.Optional(t.String()),
  practice_date: t.Optional(t.String()),
  location: t.Optional(t.Nullable(t.String())),
  duration: t.Optional(t.Union([t.String(), t.Number()])),
  image_path: t.Optional(t.Nullable(t.String()))
});

export const reviewRecordBodySchema = t.Object({
  status: t.Union([
    t.Literal('approved'),
    t.Literal('rejected'),
    t.Literal('pending')
  ]),
  comment: t.Optional(t.String())
});

export const batchReviewBodySchema = t.Object({
  ids: t.Array(t.Number({ minimum: 1 }), { minItems: 1, uniqueItems: true }),
  action: t.Union([
    t.Literal('approved'),
    t.Literal('rejected'),
    t.Literal('pending'),
    t.Literal('deleted')
  ])
});

export const recordQuerySchema = t.Object({
  student_id: t.Optional(t.String({ pattern: positiveIdPattern })),
  teacher_id: t.Optional(t.String({ pattern: positiveIdPattern })),
  status: t.Optional(recordStatusSchema),
  practice_after: t.Optional(t.String()),
  practice_before: t.Optional(t.String()),
  created_after: t.Optional(t.String()),
  created_before: t.Optional(t.String()),
  updated_after: t.Optional(t.String()),
  updated_before: t.Optional(t.String())
});

export const roleQuerySchema = t.Object({
  role: t.Optional(userRoleSchema)
});

export function apiError(code: number, message: string) {
  return status(code, { error: message });
}

export function asRequiredString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function asOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value.trim() || null;
}

export function parsePositiveId(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function isValidDateInput(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

export function isValidUploadPath(value: string): boolean {
  return uploadPathPattern.test(value);
}

export function validateRecordFilters(query: RecordFilters): string | null {
  const dateFields: Array<keyof RecordFilters> = [
    'practice_after',
    'practice_before',
    'created_after',
    'created_before',
    'updated_after',
    'updated_before'
  ];

  for (const field of dateFields) {
    const value = query[field];
    if (typeof value === 'string' && value && !isValidDateInput(value)) {
      return '筛选日期格式无效。';
    }
  }

  return null;
}

export function validatePassword(value: string): string | null {
  if (!value) return '密码不能为空。';
  if (value.length < 8) return '密码至少需要 8 位。';
  return null;
}

export function validateName(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return '姓名不能为空。';
  return null;
}

export function checkDate(date: string): boolean {
  const timestamp = Date.parse(date);
  return Number.isFinite(timestamp) && timestamp <= Date.now() + 14 * 60 * 60 * 1000;
}

export function checkStudentDuration(duration: number) {
  return duration >= 0.1;
}

export function checkTeacherDuration(duration: number) {
  return duration >= 0.1 && Number.isInteger(duration * 10);
}

export function normalizeRecordFilters(query: RecordFilters) {
  return {
    student_id: query.student_id ?? null,
    teacher_id: query.teacher_id ?? null,
    status: query.status ?? null,
    practice_after: query.practice_after ?? null,
    practice_before: query.practice_before ?? null,
    created_after: query.created_after ?? null,
    created_before: query.created_before ?? null,
    updated_after: query.updated_after ?? null,
    updated_before: query.updated_before ?? null
  } satisfies RecordFilters;
}

export function requireAuthenticatedUser(
  user: AuthTokenPayload | null,
  authError: string | null
) {
  if (!user) {
    return apiError(401, authError ?? '缺少认证令牌。');
  }

  return undefined;
}

export function requireRole(
  user: AuthTokenPayload | null,
  authError: string | null,
  roles: UserRole[]
) {
  const authFailure = requireAuthenticatedUser(user, authError);
  if (authFailure) return authFailure;

  const currentUser = user as AuthTokenPayload;

  if (!roles.includes(currentUser.role)) {
    return apiError(403, '没有权限访问该资源。');
  }

  return undefined;
}
