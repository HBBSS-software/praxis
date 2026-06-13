import { createPQSealServer, PQSealError, type FieldSealedObject } from 'pqseal';

const passwordSeal = createPQSealServer({
  challengeTtlMs: 60 * 1000,
  keyRotationMs: 30 * 60 * 1000
});

export class PasswordSealError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PasswordSealError';
  }
}

export function issuePasswordSealChallenge() {
  return passwordSeal.issueChallenge();
}

function mapSealError(error: PQSealError) {
  if (error.code === 'CHALLENGE_EXPIRED' || error.code === 'CHALLENGE_REPLAYED') {
    return '加密挑战已失效，请重试。';
  }

  if (error.code === 'BAD_ENVELOPE' || error.code === 'BAD_KEM') {
    return '密码格式无效。';
  }

  return '密码解密失败，请重试。';
}

function normalizeExpectedFields(fields: readonly string[]) {
  return new Set(fields);
}

function assertNoPlainPasswordFields(body: Record<string, unknown>, fields: readonly string[]) {
  for (const field of fields) {
    const value = body[field];

    if (typeof value === 'string' && value !== '') {
      throw new PasswordSealError('密码格式无效。');
    }
  }
}

function validateSealedFields(body: Record<string, unknown>, fields: readonly string[], required: boolean) {
  const sealedFields = body.__pqsealFields;
  const hasEnvelope = body.__pqseal !== undefined;

  if (!Array.isArray(sealedFields) || !hasEnvelope) {
    if (required || hasEnvelope || sealedFields !== undefined) {
      throw new PasswordSealError('密码格式无效。');
    }

    return null;
  }

  const expected = normalizeExpectedFields(fields);
  const received = sealedFields.map(String);
  const uniqueReceived = new Set(received);

  if (received.length === 0 || uniqueReceived.size !== received.length || received.some((field) => !expected.has(field))) {
    throw new PasswordSealError('密码格式无效。');
  }

  if (required && (received.length !== fields.length || fields.some((field) => !uniqueReceived.has(field)))) {
    throw new PasswordSealError('密码格式无效。');
  }

  return received;
}

export function openPasswordFields<T extends Record<string, unknown>, K extends string>(
  body: T,
  fields: readonly K[],
  options: { required?: boolean } = {}
): T & Record<K, string> {
  const required = options.required ?? true;
  assertNoPlainPasswordFields(body, fields);
  const sealedFields = validateSealedFields(body, fields, required);

  if (!sealedFields) {
    return body as T & Record<K, string>;
  }

  try {
    const opened = passwordSeal.openFields(body as unknown as FieldSealedObject) as T & Record<K, string>;

    for (const field of sealedFields) {
      if (typeof opened[field as K] !== 'string') {
        throw new PasswordSealError('密码格式无效。');
      }
    }

    return opened;
  } catch (error) {
    if (error instanceof PasswordSealError) {
      throw error;
    }

    if (error instanceof PQSealError) {
      throw new PasswordSealError(mapSealError(error));
    }

    throw error;
  }
}
