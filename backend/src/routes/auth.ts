import { Elysia } from 'elysia';

import { clearLoginFailures, getRemainingLockoutMs, recordLoginFailure } from '../auth/login-attempts';
import { hashPassword, verifyPassword } from '../auth/password';
import database from '../database';
import {
  apiError,
  loginBodySchema,
  passwordBodySchema,
  profileBodySchema,
  requireAuthenticatedUser,
  validateName,
  validatePassword
} from '../http';
import { authPlugin } from '../plugins/auth';

const dummyPasswordHash = await hashPassword('not-the-real-password');

function resolveClientKey(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown';
}

export const authRoutes = new Elysia({ prefix: '/auth' })
  .use(authPlugin)
  .post('/login', async ({ body, request, accessJwt, set }) => {
    const uid = body.uid.trim();
    const password = body.password;
    const clientKey = resolveClientKey(request);

    if (!uid || !password) {
      return apiError(400, 'UID 和密码不能为空。');
    }

    const remainingMs = getRemainingLockoutMs(clientKey);

    if (remainingMs > 0) {
      set.headers['cache-control'] = 'no-store';
      return apiError(429, `登录失败次数过多，请在 ${Math.ceil(remainingMs / 1000)} 秒后重试。`);
    }

    const user = database.findUserByUid(uid);

    if (!user) {
      await verifyPassword(password, dummyPasswordHash);
      recordLoginFailure(clientKey);
      set.headers['cache-control'] = 'no-store';
      return apiError(401, 'UID 或密码错误。');
    }

    const passwordMatched = await verifyPassword(password, user.password);

    if (!passwordMatched) {
      recordLoginFailure(clientKey);
      set.headers['cache-control'] = 'no-store';
      return apiError(401, 'UID 或密码错误。');
    }

    clearLoginFailures(clientKey);

    const authUser = {
      id: user.id,
      uid: user.uid,
      role: user.role,
      name: user.name
    };

    set.headers['cache-control'] = 'no-store';

    return {
      token: await accessJwt.sign(authUser),
      user: authUser
    };
  }, {
    body: loginBodySchema
  })
  .get('/me', ({ user, authError, set }) => {
    const authFailure = requireAuthenticatedUser(user, authError);

    if (authFailure) {
      return authFailure;
    }

    set.headers['cache-control'] = 'no-store';
    return { user };
  })
  .put('/password', async ({ body, user, authError }) => {
    const authFailure = requireAuthenticatedUser(user, authError);

    if (authFailure) {
      return authFailure;
    }

    const userRecord = database.findUserById(user!.id);

    if (!userRecord) {
      return apiError(404, '用户不存在。');
    }

    const passwordError = validatePassword(body.new_password);

    if (passwordError) {
      return apiError(400, passwordError);
    }

    const matched = await verifyPassword(body.current_password, userRecord.password);

    if (!matched) {
      return apiError(401, '当前密码错误。');
    }

    database.updateUserPassword(userRecord.id, await hashPassword(body.new_password));
    return { message: '密码修改成功。' };
  }, {
    body: passwordBodySchema
  })
  .put('/profile', async ({ body, user, authError }) => {
    const authFailure = requireAuthenticatedUser(user, authError);

    if (authFailure) {
      return authFailure;
    }

    if (user!.role === 'student') {
      return apiError(403, '学生不能修改姓名。');
    }

    const nameError = validateName(body.name);

    if (nameError) {
      return apiError(400, nameError);
    }

    const userRecord = database.findUserById(user!.id);

    if (!userRecord) {
      return apiError(404, '用户不存在。');
    }

    const matched = await verifyPassword(body.current_password, userRecord.password);

    if (!matched) {
      return apiError(401, '当前密码错误。');
    }

    database.updateUserName(userRecord.id, body.name.trim());
    return { message: '姓名修改成功。' };
  }, {
    body: profileBodySchema
  });
