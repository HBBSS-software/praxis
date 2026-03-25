import { treaty } from '@elysiajs/eden';

import type { Api } from '../../../backend/src/app';
import { API_URL, type CreatedUser, type CsvImportPreview, type StoredUser, type UploadResult } from './types';

export class ApiResponseError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function getAuthorizationHeaders(token?: string | null) {
  if (!token) {
    return undefined;
  }

  return {
    authorization: `Bearer ${token}`
  };
}

export function getApiOrigin() {
  const apiBase = API_URL.replace(/\/api$/, '');

  if (/^https?:\/\//.test(apiBase)) {
    return apiBase;
  }

  if (typeof window !== 'undefined') {
    return apiBase ? new URL(apiBase, window.location.origin).toString().replace(/\/$/, '') : window.location.origin;
  }

  return apiBase ? `http://localhost${apiBase}` : 'http://localhost';
}

export function createApiClient(token?: string | null) {
  const headers = getAuthorizationHeaders(token);

  return treaty<Api>(getApiOrigin(), headers ? { headers } : undefined).api;
}

export async function unwrapResponse<T>(request: Promise<{ data: unknown; error: unknown; status: number }>): Promise<T> {
  const response = await request;

  if (response.error) {
    const message = typeof response.error === 'object'
      && response.error !== null
      && 'value' in response.error
      && typeof response.error.value === 'object'
      && response.error.value !== null
      && 'error' in response.error.value
      && typeof response.error.value.error === 'string'
      ? response.error.value.error
      : '请求失败。';

    throw new ApiResponseError(response.status, message);
  }

  return response.data as T;
}

export async function login(uid: string, password: string): Promise<{ token: string; user: StoredUser }> {
  const api = createApiClient();
  return unwrapResponse(api.auth.login.post({ uid, password }));
}

export async function uploadImage(file: File, token: string): Promise<UploadResult> {
  const api = createApiClient(token);
  return unwrapResponse(api.upload.post({ image: file }));
}

export async function importUserCsv(file: File, token: string): Promise<{ message: string; encoding: CsvImportPreview['encoding']; users: CreatedUser[] }> {
  const api = createApiClient(token);
  return unwrapResponse(api.admin.users.import.post({ file }));
}
