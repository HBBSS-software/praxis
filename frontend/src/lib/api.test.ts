// @vitest-environment node
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createPQSealServer, type FieldSealedObject } from 'pqseal';
import { ApiResponseError, formatUploadImageMaxSize, getPasswordRequirementStates, sealPasswordFieldsForApi, unwrapResponse, validatePlainPassword } from './api';

afterEach(() => {
  vi.restoreAllMocks();
});

test('ApiResponseError stores status and message', () => {
  const error = new ApiResponseError(404, '未找到');
  expect(error.status).toBe(404);
  expect(error.message).toBe('未找到');
  expect(error).toBeInstanceOf(Error);
});

describe('formatUploadImageMaxSize', () => {
  test('formats MiB values', () => {
    expect(formatUploadImageMaxSize(5 * 1024 * 1024)).toBe('5 MiB');
  });

  test('formats KiB values', () => {
    expect(formatUploadImageMaxSize(500 * 1024)).toBe('500 KiB');
  });

  test('formats byte values', () => {
    expect(formatUploadImageMaxSize(999)).toBe('999 B');
  });

  test('handles 0 bytes', () => {
    expect(formatUploadImageMaxSize(0)).toBe('0 MiB');
  });

  test('handles 1 byte', () => {
    expect(formatUploadImageMaxSize(1)).toBe('1 B');
  });
});

describe('password helpers', () => {
  test('seals non-empty password fields with PQSeal', async () => {
    const server = createPQSealServer();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(server.issueChallenge()), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }));

    const sealed = await sealPasswordFieldsForApi({
      uid: '1',
      password: 'correct horse battery',
      optional_password: ''
    }, ['password', 'optional_password']) as FieldSealedObject & { optional_password: string };

    expect(sealed.password).toBeUndefined();
    expect(sealed.optional_password).toBe('');
    expect(sealed.__pqsealFields).toEqual(['password']);
    expect(server.openFields(sealed).password).toBe('correct horse battery');
  });

  test('validates plain password policy only in production', () => {
    expect(validatePlainPassword('', { is_production: false })).toBe('密码不能为空。');
    expect(validatePlainPassword('1234567', { is_production: false })).toBeNull();
    expect(validatePlainPassword('1234567', { is_production: true })).toBe('密码至少需要 8 位。');
    expect(validatePlainPassword('A1!'.repeat(11), { is_production: true })).toBe('密码不能超过 32 位。');
    expect(validatePlainPassword('abcdefgh', { is_production: true })).toBe('密码必须包含大写字母、小写字母、数字和特殊符号。');
    expect(validatePlainPassword('Abcdef1!', { is_production: true })).toBeNull();
    expect(validatePlainPassword('1234567', { is_production: true }, { enforcePolicy: false })).toBeNull();
  });

  test('reports dynamic password requirement states', () => {
    const states = Object.fromEntries(getPasswordRequirementStates('').map((item) => [item.id, item.met]));
    expect(states).toEqual({
      length: false,
      uppercase: false,
      lowercase: false,
      number: false,
      special: false
    });

    const validStates = Object.fromEntries(getPasswordRequirementStates('Abcdef1!').map((item) => [item.id, item.met]));
    expect(validStates).toEqual({
      length: true,
      uppercase: true,
      lowercase: true,
      number: true,
      special: true
    });
  });

  test('identifies missing password requirements', () => {
    expect(Object.fromEntries(getPasswordRequirementStates('Abc1!').map((item) => [item.id, item.met]))).toMatchObject({ length: false });
    expect(Object.fromEntries(getPasswordRequirementStates('A1!'.repeat(11)).map((item) => [item.id, item.met]))).toMatchObject({ length: false });
    expect(Object.fromEntries(getPasswordRequirementStates('abcdef1!').map((item) => [item.id, item.met]))).toMatchObject({ uppercase: false });
    expect(Object.fromEntries(getPasswordRequirementStates('ABCDEF1!').map((item) => [item.id, item.met]))).toMatchObject({ lowercase: false });
    expect(Object.fromEntries(getPasswordRequirementStates('Abcdefg!').map((item) => [item.id, item.met]))).toMatchObject({ number: false });
    expect(Object.fromEntries(getPasswordRequirementStates('Abcdef12').map((item) => [item.id, item.met]))).toMatchObject({ special: false });
  });
});

describe('unwrapResponse', () => {
  test('resolves with data on success', async () => {
    const result = await unwrapResponse<{ key: string }>(
      Promise.resolve({ data: { key: 'value' }, error: null, status: 200 })
    );
    expect(result).toEqual({ key: 'value' });
  });

  test('throws ApiResponseError on error', async () => {
    await expect(
      unwrapResponse(Promise.resolve({ data: null, error: '出错啦', status: 400 }))
    ).rejects.toThrow(ApiResponseError);
  });

  test('throws ApiResponseError with correct status', async () => {
    try {
      await unwrapResponse(Promise.resolve({ data: null, error: 'Not Found', status: 404 }));
    } catch (error) {
      expect(error).toBeInstanceOf(ApiResponseError);
      expect((error as ApiResponseError).status).toBe(404);
    }
  });

  test('throws with fallback message when error is empty object', async () => {
    await expect(
      unwrapResponse(Promise.resolve({ data: null, error: {}, status: 500 }))
    ).rejects.toThrow('请求失败。');
  });

  test('handles Error instance in response', async () => {
    await expect(
      unwrapResponse(Promise.resolve({ data: null, error: new Error('自定义错误'), status: 403 }))
    ).rejects.toThrow('自定义错误');
  });
});
