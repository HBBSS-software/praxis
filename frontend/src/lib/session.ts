import type { StoredUser, UserRole } from './types';

const tokenStorageKey = 'auth.token';
const userStorageKey = 'auth.user';

export function getToken() {
  return sessionStorage.getItem(tokenStorageKey);
}

export function getStoredUser(): StoredUser | null {
  const rawUser = sessionStorage.getItem(userStorageKey);
  if (!rawUser) return null;

  try {
    const user = JSON.parse(rawUser) as Partial<StoredUser>;
    if (
      typeof user.id !== 'number' ||
      typeof user.uid !== 'string' ||
      typeof user.name !== 'string' ||
      (user.role !== 'admin' && user.role !== 'teacher' && user.role !== 'student')
    ) {
      return null;
    }

    return user as StoredUser;
  } catch {
    return null;
  }
}

export function storeSession(token: string, user: StoredUser) {
  sessionStorage.setItem(tokenStorageKey, token);
  sessionStorage.setItem(userStorageKey, JSON.stringify(user));
}

export function clearSession() {
  sessionStorage.removeItem(tokenStorageKey);
  sessionStorage.removeItem(userStorageKey);
}

export function getDefaultPathByRole(role: UserRole) {
  return role === 'admin'
    ? '/admin/records'
    : role === 'teacher'
      ? '/teacher/dashboard'
      : '/student/dashboard';
}
