import { loginLockoutMs, loginMaxAttempts } from './config';

interface AttemptState {
  count: number;
  lastAttemptAt: number;
  lockedUntil: number | null;
}

const attempts = new Map<string, AttemptState>();

function getState(key: string, now = Date.now()) {
  const current = attempts.get(key);

  if (!current) {
    const created: AttemptState = {
      count: 0,
      lastAttemptAt: now,
      lockedUntil: null
    };

    attempts.set(key, created);
    return created;
  }

  if (current.lockedUntil !== null && current.lockedUntil <= now) {
    current.count = 0;
    current.lockedUntil = null;
  }

  current.lastAttemptAt = now;
  return current;
}

function prune(now = Date.now()) {
  for (const [key, state] of attempts.entries()) {
    if (state.lockedUntil === null && now - state.lastAttemptAt > loginLockoutMs * 2) {
      attempts.delete(key);
    }
  }
}

export function getRemainingLockoutMs(key: string, now = Date.now()) {
  prune(now);
  const state = getState(key, now);

  if (state.lockedUntil === null) {
    return 0;
  }

  return Math.max(0, state.lockedUntil - now);
}

export function recordLoginFailure(key: string, now = Date.now()) {
  prune(now);
  const state = getState(key, now);
  state.count += 1;

  if (state.count >= loginMaxAttempts) {
    state.lockedUntil = now + loginLockoutMs;
  }

  return getRemainingLockoutMs(key, now);
}

export function clearLoginFailures(key: string) {
  attempts.delete(key);
}
