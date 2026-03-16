import { loginLockoutMs, loginMaxAttempts } from './config';

interface LoginAttemptState {
  count: number;
  lastAttemptAt: number;
  lockedUntil: number | null;
}

const attempts = new Map<string, LoginAttemptState>();

function getState(key: string, now = Date.now()): LoginAttemptState {
  const current = attempts.get(key);

  if (!current) {
    const nextState: LoginAttemptState = {
      count: 0,
      lastAttemptAt: now,
      lockedUntil: null
    };
    attempts.set(key, nextState);
    return nextState;
  }

  if (current.lockedUntil !== null && current.lockedUntil <= now) {
    current.count = 0;
    current.lockedUntil = null;
  }

  current.lastAttemptAt = now;
  return current;
}

function prune(now = Date.now()): void {
  for (const [key, state] of attempts.entries()) {
    const isExpired = state.lockedUntil === null && now - state.lastAttemptAt > loginLockoutMs * 2;

    if (isExpired) {
      attempts.delete(key);
    }
  }
}

export function getRemainingLockoutMs(key: string, now = Date.now()): number {
  prune(now);
  const state = getState(key, now);

  if (state.lockedUntil === null) {
    return 0;
  }

  return Math.max(state.lockedUntil - now, 0);
}

export function recordLoginFailure(key: string, now = Date.now()): number {
  prune(now);
  const state = getState(key, now);
  state.count += 1;

  if (state.count >= loginMaxAttempts) {
    state.lockedUntil = now + loginLockoutMs;
  }

  return getRemainingLockoutMs(key, now);
}

export function clearLoginFailures(key: string): void {
  attempts.delete(key);
}
