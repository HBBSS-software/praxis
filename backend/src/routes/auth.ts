import { Elysia } from 'elysia';

import { clearLoginFailures, getRemainingLockoutMs, recordLoginFailure } from '../auth/login-attempts';
import { hashPassword, verifyPassword } from '../auth/password';
import database from '../database';
import {
  apiError,
  asRequiredString,
  loginBodySchema,
  passwordBodySchema,
  profileBodySchema,
  requireAuthenticatedUser
} from '../http';
import { authPlugin } from '../plugins/auth';

const dummyPasswordHash = await hashPassword('not-the-real-password');

export const authRoutes = new Elysia({ prefix: '/auth' })
  .use(authPlugin)
  .post(
    '/login',
    async ({ body, request, accessJwt, set }) => {
      const uid = body.uid.trim();
      const password = body.password;
      const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        ?? request.headers.get('x-real-ip')
        ?? 'unknown';

      if (!uid || !password) {
        return apiError(400, 'UID 和密码不能为空。');
      }

      const remainingMs = getRemainingLockoutMs(ipAddress);
      if (remainingMs > 0) {
        set.headers['cache-control'] = 'no-store';
        return apiError(429, `登录失败次数过多，请在 ${Math.ceil(remainingMs / 1000)} 秒后重试。`);
      }

      const user = database.findUserByUid(uid);

      if (!user) {
        await verifyPassword(password, dummyPasswordHash);
        recordLoginFailure(ipAddress);
        set.headers['cache-control'] = 'no-store';
        return apiError(401, 'UID 或密码错误。');
      }

      const isValid = await verifyPassword(password, user.password);
      if (!isValid) {
        recordLoginFailure(ipAddress);
        set.headers['cache-control'] = 'no-store';
        return apiError(401, 'UID 或密码错误。');
      }

      clearLoginFailures(ipAddress);

      const authUser = {
        id: user.id,
        uid: user.uid,
        role: user.role,
        name: user.name
      };

      const token = await accessJwt.sign(authUser);

      set.headers['cache-control'] = 'no-store';

      return {
        token,
        user: authUser
      };
    },
    {
      body: loginBodySchema
    }
  )
  .get('/me', ({ user, authError, set }) => {
    const authFailure = requireAuthenticatedUser(user, authError);
    if (authFailure) return authFailure;

    set.headers['cache-control'] = 'no-store';
    return { user };
  })
  .put('/password', async ({ body, user, authError }) => {
    const authFailure = requireAuthenticatedUser(user, authError);
    if (authFailure) return authFailure;

    const currentPassword = body.current_password;
    const newPassword = body.new_password;

    if (!currentPassword || !newPassword) {
      return apiError(400, '当前密码和新密码不能为空。');
    }

    if (newPassword.length < 8) {
      return apiError(400, '新密码至少需要 8 位。');
    }

    const currentUser = database.findUserById(user!.id);
    if (!currentUser) {
      return apiError(404, '用户不存在。');
    }

    const isValid = await verifyPassword(currentPassword, currentUser.password);
    if (!isValid) {
      return apiError(401, '当前密码错误。');
    }

    database.updateUserPassword(currentUser.id, await hashPassword(newPassword));
    return { message: '密码修改成功。' };
  }, {
    body: passwordBodySchema
  })
  .put('/profile', async ({ body, user, authError }) => {
    const authFailure = requireAuthenticatedUser(user, authError);
    if (authFailure) return authFailure;

    if (user!.role === 'student') {
      return apiError(403, '学生不能修改姓名。');
    }

    const currentPassword = body.current_password;
    const newName = asRequiredString(body.name);

    if (!currentPassword || !newName) {
      return apiError(400, '当前密码和新姓名不能为空。');
    }

    const currentUser = database.findUserById(user!.id);
    if (!currentUser) {
      return apiError(404, '用户不存在。');
    }

    const isValid = await verifyPassword(currentPassword, currentUser.password);
    if (!isValid) {
      return apiError(401, '当前密码错误。');
    }

    database.updateUserName(currentUser.id, newName);
    return { message: '姓名修改成功。' };
  }, {
    body: profileBodySchema
  });
