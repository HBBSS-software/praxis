import { beforeAll, describe, expect, test } from 'vitest';
import { createPQSealClient } from 'pqseal';

type PasswordSealModule = typeof import('../src/auth/password-seal.js');

const client = createPQSealClient();

let issuePasswordSealChallenge: PasswordSealModule['issuePasswordSealChallenge'];
let openPasswordFields: PasswordSealModule['openPasswordFields'];
let PasswordSealError: PasswordSealModule['PasswordSealError'];

beforeAll(async () => {
  const module = await import('../src/auth/password-seal.js');
  issuePasswordSealChallenge = module.issuePasswordSealChallenge;
  openPasswordFields = module.openPasswordFields;
  PasswordSealError = module.PasswordSealError;
});

function sealFields<T extends Record<string, unknown>>(body: T, keys: Array<keyof T>) {
  return client.sealFields(issuePasswordSealChallenge(), body, keys);
}

describe('password seal', () => {
  test('publishes a PQSeal challenge', () => {
    const challenge = issuePasswordSealChallenge();

    expect(challenge.v).toBe(1);
    expect(challenge.kem).toBe('ml-kem-768');
    expect(challenge.publicKey).toEqual(expect.any(String));
    expect(challenge.challenge).toEqual(expect.any(String));
    expect(challenge.expiresAt).toBeGreaterThan(Date.now());
  });

  test('opens sealed password fields', () => {
    const sealed = sealFields({ uid: '1', password: 's3cr3t-password' }, ['password']);
    const opened = openPasswordFields(sealed, ['password']);

    expect(opened.uid).toBe('1');
    expect(opened.password).toBe('s3cr3t-password');
  });

  test('rejects replayed sealed fields', () => {
    const sealed = sealFields({ password: 'another-password' }, ['password']);

    expect(openPasswordFields(sealed, ['password']).password).toBe('another-password');
    expect(() => openPasswordFields(sealed, ['password'])).toThrow(PasswordSealError);
  });

  test('rejects plaintext password fields', () => {
    expect(() => openPasswordFields({ password: 'plain' }, ['password'])).toThrow(PasswordSealError);
  });

  test('allows absent optional password fields', () => {
    const opened = openPasswordFields({ name: '测试用户', password: '' }, ['password'], { required: false });

    expect(opened.name).toBe('测试用户');
    expect(opened.password).toBe('');
  });
});
