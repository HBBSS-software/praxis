import { Elysia, t } from 'elysia';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { apiError } from '../http';
import { authPlugin } from '../plugins/auth';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(currentDir, '..', '..', 'uploads');
const maxUploadImageSize = 5 * 1024 * 1024;

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const uploadExtensionByType: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif'
};

function detectImageType(bytes: Uint8Array) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return 'image/gif';
  }

  return null;
}

export const uploadRoutes = new Elysia()
  .use(authPlugin)
  .post('/upload', async ({ body, user, authError }) => {
    if (!user) {
      return apiError(401, authError ?? '缺少认证令牌。');
    }

    if (body.image.size > maxUploadImageSize) {
      return apiError(400, '图片大小不能超过 5 MiB。');
    }

    const imageHeader = new Uint8Array(await body.image.slice(0, 8).arrayBuffer());
    const imageType = detectImageType(imageHeader);

    if (!imageType) {
      return apiError(400, '仅支持上传 JPG、PNG、GIF 格式的图片。');
    }

    const extension = uploadExtensionByType[imageType];
    const filename = `${randomUUID()}${extension}`;
    await Bun.write(path.join(uploadDir, filename), body.image);

    return {
      message: '上传成功。',
      filename,
      imageUrl: `/uploads/${filename}`
    };
  }, {
    body: t.Object({
      image: t.File({
        type: ['image/jpeg', 'image/png', 'image/gif'],
        maxSize: '5m'
      })
    })
  });
