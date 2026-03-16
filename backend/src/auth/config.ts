const DEFAULT_JWT_SECRET = 'development-only-jwt-secret-change-me';
const DEFAULT_JWT_AUDIENCE = 'social-practice-users';
const DEFAULT_JWT_ISSUER = 'social-practice-system';

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsedValue = Number(value);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
}

export const isProduction = process.env.NODE_ENV === 'production';

export const jwtSecret = process.env.JWT_SECRET ?? DEFAULT_JWT_SECRET;
export const jwtAudience = process.env.JWT_AUDIENCE ?? DEFAULT_JWT_AUDIENCE;
export const jwtIssuer = process.env.JWT_ISSUER ?? DEFAULT_JWT_ISSUER;
export const tokenLifetime = (process.env.JWT_EXPIRES_IN ?? '8h') as SignOptions['expiresIn'];
export const loginMaxAttempts = parsePositiveInteger(process.env.LOGIN_MAX_ATTEMPTS, 5);
export const loginLockoutMs = parsePositiveInteger(process.env.LOGIN_LOCKOUT_MS, 15 * 60 * 1000);

if (process.env.JWT_SECRET === undefined) {
  const warningMessage =
    'JWT_SECRET is not set. Using a development fallback secret. Configure JWT_SECRET before deployment.';

  if (isProduction) {
    throw new Error(warningMessage);
  }

  console.warn(warningMessage);
}

if (jwtSecret.length < 32) {
  const warningMessage = 'JWT_SECRET should be at least 32 characters long.';

  if (isProduction) {
    throw new Error(warningMessage);
  }

  console.warn(warningMessage);
}
import type { SignOptions } from 'jsonwebtoken';
