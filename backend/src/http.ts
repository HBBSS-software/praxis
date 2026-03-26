import { status, t } from 'elysia';

import type { AuthTokenPayload, PublicUser, RecordFilters, RecordStatus, UserRole } from './models';

const positiveIdPattern = '^[1-9]\\d*$';
const uploadPathPattern = /^\/uploads\/[A-Za-z0-9][A-Za-z0-9._-]*$/;
const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

export const USER_NAME_MAX_LENGTH = 40;
export const TITLE_MAX_LENGTH = 120;
export const LOCATION_MAX_LENGTH = 120;
export const CONTENT_MAX_LENGTH = 5000;
export const COMMENT_MAX_LENGTH = 500;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const UID_MAX_LENGTH = 32;
export const MAX_RECORD_DURATION = 24;

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

export const idParamSchema = t.Object({
  id: t.String({ pattern: positiveIdPattern })
});

export const roleQuerySchema = t.Object({
  role: t.Optional(userRoleSchema)
});

export const loginBodySchema = t.Object({
  uid: t.String({ minLength: 1, maxLength: UID_MAX_LENGTH }),
  password: t.String({ minLength: 1, maxLength: PASSWORD_MAX_LENGTH })
});

export const profileBodySchema = t.Object({
  current_password: t.String({ minLength: 1, maxLength: PASSWORD_MAX_LENGTH }),
  name: t.String({ minLength: 1, maxLength: USER_NAME_MAX_LENGTH })
});

export const passwordBodySchema = t.Object({
  current_password: t.String({ minLength: 1, maxLength: PASSWORD_MAX_LENGTH }),
  new_password: t.String({ minLength: 1, maxLength: PASSWORD_MAX_LENGTH })
});

export const updateUserBodySchema = t.Object({
  name: t.Optional(t.String({ minLength: 1, maxLength: USER_NAME_MAX_LENGTH })),
  password: t.Optional(t.String({ maxLength: PASSWORD_MAX_LENGTH }))
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
  title: t.String({ minLength: 1, maxLength: TITLE_MAX_LENGTH }),
  content: t.String({ minLength: 1, maxLength: CONTENT_MAX_LENGTH }),
  practice_date: t.String({ minLength: 1, maxLength: 10 }),
  location: t.Optional(t.Nullable(t.String({ maxLength: LOCATION_MAX_LENGTH }))),
  duration: t.Union([t.String({ minLength: 1, maxLength: 16 }), t.Number()]),
  image_path: t.Optional(t.Nullable(t.String()))
});

export const updateRecordBodySchema = t.Object({
  title: t.Optional(t.String({ minLength: 1, maxLength: TITLE_MAX_LENGTH })),
  content: t.Optional(t.String({ minLength: 1, maxLength: CONTENT_MAX_LENGTH })),
  practice_date: t.Optional(t.String({ minLength: 1, maxLength: 10 })),
  location: t.Optional(t.Nullable(t.String({ maxLength: LOCATION_MAX_LENGTH }))),
  duration: t.Optional(t.Union([t.String({ minLength: 1, maxLength: 16 }), t.Number()])),
  image_path: t.Optional(t.Nullable(t.String()))
});

export const reviewRecordBodySchema = t.Object({
  status: recordStatusSchema,
  comment: t.Optional(t.String({ maxLength: COMMENT_MAX_LENGTH }))
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

export function apiError(code: number, message: string) {
  return status(code, { error: message });
}

export function toPublicUser(user: PublicUser | AuthTokenPayload): PublicUser {
  return {
    id: user.id,
    uid: user.uid,
    role: user.role,
    name: user.name
  };
}

export function parsePositiveId(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function normalizeRequiredString(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

export function normalizeOptionalString(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

export function validateName(name: string) {
  const trimmed = name.trim();

  if (!trimmed) {
    return '姓名不能为空。';
  }

  if (trimmed.length > USER_NAME_MAX_LENGTH) {
    return `姓名不能超过 ${USER_NAME_MAX_LENGTH} 个字符。`;
  }

  return null;
}

export function validatePassword(password: string) {
  if (!password) {
    return '密码不能为空。';
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return `密码至少需要 ${PASSWORD_MIN_LENGTH} 位。`;
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return `密码不能超过 ${PASSWORD_MAX_LENGTH} 位。`;
  }

  return null;
}

export function validateTitle(title: string) {
  const trimmed = title.trim();

  if (!trimmed) {
    return '标题不能为空。';
  }

  if (trimmed.length > TITLE_MAX_LENGTH) {
    return `标题不能超过 ${TITLE_MAX_LENGTH} 个字符。`;
  }

  return null;
}

export function validateContent(content: string) {
  const trimmed = content.trim();

  if (!trimmed) {
    return '实践内容不能为空。';
  }

  if (trimmed.length > CONTENT_MAX_LENGTH) {
    return `实践内容不能超过 ${CONTENT_MAX_LENGTH} 个字符。`;
  }

  return null;
}

export function validateLocation(location: string | null) {
  if (location && location.length > LOCATION_MAX_LENGTH) {
    return `地点不能超过 ${LOCATION_MAX_LENGTH} 个字符。`;
  }

  return null;
}

export function validateComment(comment: string | null) {
  if (comment && comment.length > COMMENT_MAX_LENGTH) {
    return `评语不能超过 ${COMMENT_MAX_LENGTH} 个字符。`;
  }

  return null;
}

export function isValidUploadPath(value: string) {
  return uploadPathPattern.test(value);
}

export function validatePracticeDate(value: string) {
  if (!dateOnlyPattern.test(value)) {
    return '实践日期格式无效。';
  }

  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return '实践日期格式无效。';
  }

  const today = new Date();
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  if (value > localToday) {
    return '不能记录未来的活动。';
  }

  return null;
}

export function parseDuration(value: unknown) {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? Number(trimmed) : Number.NaN;
  }

  return Number.NaN;
}

export function validateDuration(duration: number) {
  if (!Number.isFinite(duration)) {
    return '时长不能为空。';
  }

  if (duration < 0.1) {
    return '时长不能少于 0.1 小时。';
  }

  if (duration > MAX_RECORD_DURATION) {
    return `单条记录时长不能超过 ${MAX_RECORD_DURATION} 小时。`;
  }

  if (!Number.isInteger(duration * 10)) {
    return '时长必须是 0.1 的倍数。';
  }

  return null;
}

export function validateDateTimeInput(value: string) {
  return Number.isFinite(Date.parse(value));
}

export function validateRecordFilters(query: Record<string, unknown>) {
  const dateFields = [
    'practice_after',
    'practice_before',
    'created_after',
    'created_before',
    'updated_after',
    'updated_before'
  ] as const;

  for (const field of dateFields) {
    const value = query[field];

    if (typeof value === 'string' && value && !validateDateTimeInput(value)) {
      return '筛选日期格式无效。';
    }
  }

  return null;
}

export function normalizeRecordFilters(query: RecordFilters): RecordFilters {
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
  };
}

export function requireAuthenticatedUser(user: PublicUser | null, authError: string | null) {
  if (!user) {
    return apiError(401, authError ?? '缺少认证令牌。');
  }

  return undefined;
}

export function requireRole(user: PublicUser | null, authError: string | null, roles: UserRole[]) {
  const authFailure = requireAuthenticatedUser(user, authError);

  if (authFailure) {
    return authFailure;
  }

  if (!roles.includes(user!.role)) {
    return apiError(403, '没有权限访问该资源。');
  }

  return undefined;
}

export function buildReviewNotificationMessage(title: string, statusValue: RecordStatus) {
  if (statusValue === 'approved') {
    return `你的实践记录 "${title}" 已被通过。`;
  }

  if (statusValue === 'rejected') {
    return `你的实践记录 "${title}" 已被驳回。`;
  }

  return `你的实践记录 "${title}" 已被退回待审核。`;
}
