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

const uploadImageMaxSize = 5 * 1024 * 1024;
const uploadImageTypes = new Set(['image/jpeg', 'image/png', 'image/gif']);
const uploadImageNamePattern = /\.(jpe?g|png|gif)$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeErrorText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed || trimmed === '[object Object]') {
    return null;
  }

  return trimmed;
}

function extractErrorMessage(error: unknown): string | null {
  const directText = normalizeErrorText(error);

  if (directText) {
    return directText;
  }

  if (error instanceof Error) {
    const nestedValueMessage = extractErrorMessage((error as Error & { value?: unknown }).value);

    if (nestedValueMessage) {
      return nestedValueMessage;
    }

    return normalizeErrorText(error.message);
  }

  if (Array.isArray(error)) {
    for (const item of error) {
      const message = extractErrorMessage(item);

      if (message) {
        return message;
      }
    }

    return null;
  }

  if (!isRecord(error)) {
    return null;
  }

  const keys = ['error', 'message', 'value', 'cause'] as const;

  for (const key of keys) {
    const message = extractErrorMessage(error[key]);

    if (message) {
      return message;
    }
  }

  if (Array.isArray(error.errors)) {
    for (const item of error.errors) {
      const message = extractErrorMessage(item);

      if (message) {
        return message;
      }
    }
  }

  return null;
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
    const message = extractErrorMessage(response.error) ?? '请求失败。';

    throw new ApiResponseError(response.status, message);
  }

  return response.data as T;
}

export async function login(uid: string, password: string): Promise<{ token: string; user: StoredUser }> {
  const api = createApiClient();
  return unwrapResponse(api.auth.login.post({ uid, password }));
}

export function validateUploadImageFile(file: File) {
  if (file.size > uploadImageMaxSize) {
    throw new Error('图片大小不能超过 5 MiB。');
  }

  if (uploadImageTypes.has(file.type) || (!file.type && uploadImageNamePattern.test(file.name))) {
    return;
  }

  throw new Error('仅支持上传 JPG、PNG、GIF 格式的图片。');
}

export async function uploadImage(file: File, token: string): Promise<UploadResult> {
  validateUploadImageFile(file);
  const api = createApiClient(token);
  return unwrapResponse(api.upload.post({ image: file }));
}

export async function importUserCsv(file: File, token: string): Promise<{ message: string; encoding: CsvImportPreview['encoding']; users: CreatedUser[] }> {
  const api = createApiClient(token);
  return unwrapResponse(api.admin.users.import.post({ file }));
}
