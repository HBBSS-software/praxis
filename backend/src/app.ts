import { cors } from '@elysiajs/cors';
import staticPlugin from '@elysiajs/static';
import { Elysia } from 'elysia';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { apiError } from './http';
import { authPlugin } from './plugins/auth';
import { adminRoutes } from './routes/admin';
import { authRoutes } from './routes/auth';
import { studentRoutes } from './routes/students';
import { teacherRoutes } from './routes/teachers';
import { uploadRoutes } from './routes/upload';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.join(currentDir, '..', '..', 'frontend', 'dist');
const frontendIndexPath = path.join(frontendDir, 'index.html');
const uploadDir = path.join(currentDir, '..', 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const allowedOrigins = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const uploadsPlugin = await staticPlugin({
  assets: uploadDir,
  prefix: '/uploads',
  etag: false,
  maxAge: 0,
  indexHTML: false,
  alwaysStatic: false,
  silent: true
});

function resolveFrontendIndex() {
  if (!fs.existsSync(frontendIndexPath)) {
    return null;
  }

  return Bun.file(frontendIndexPath);
}

function resolveFrontendAsset(requestPath: string) {
  const safePath = path.normalize(requestPath).replace(/^[/\\]+/, '').replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = path.join(frontendDir, safePath);

  if (!filePath.startsWith(frontendDir)) {
    return null;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return null;
  }

  return Bun.file(filePath);
}

export const api = new Elysia({ prefix: '/api' })
  .use(
    cors({
      origin: (request) => {
        const origin = request.headers.get('origin');

        if (!origin || origin === 'null' || allowedOrigins.length === 0) {
          return true;
        }

        return allowedOrigins.includes(origin);
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
    })
  )
  .use(authPlugin)
  .use(authRoutes)
  .use(studentRoutes)
  .use(teacherRoutes)
  .use(adminRoutes)
  .use(uploadRoutes)
  .all('*', () => apiError(404, '资源不存在。'))
  .onError(({ code, error }) => {
    if (code === 'VALIDATION' || code === 'PARSE') {
      return apiError(400, error instanceof Error && error.message ? error.message : '请求参数无效。');
    }

    console.error(error);
    return apiError(500, error instanceof Error && error.message ? error.message : '服务器内部错误。');
  });

export type Api = typeof api;

export const app = new Elysia()
  .use(uploadsPlugin)
  .use(api)
  .get('/assets/*', ({ path: requestPath, set }) => {
    const asset = resolveFrontendAsset(requestPath);

    if (!asset) {
      set.status = 404;
      return '资源不存在。';
    }

    return asset;
  })
  .get('/', () => resolveFrontendIndex() ?? '前端尚未构建，请先运行 bun build:frontend。')
  .get('/health', () => ({ ok: true }))
  .all('*', ({ path: requestPath, set }) => {
    if (requestPath.startsWith('/api') || requestPath.startsWith('/uploads')) {
      return apiError(404, '资源不存在。');
    }

    const asset = resolveFrontendAsset(requestPath.slice(1));

    if (asset) {
      return asset;
    }

    const file = resolveFrontendIndex();

    if (!file) {
      set.status = 404;
      return '前端尚未构建，请先运行 bun build:frontend。';
    }

    return file;
  });

export type App = typeof app;
