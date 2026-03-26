import { jwt } from '@elysiajs/jwt';
import { Elysia } from 'elysia';

import { jwtAudience, jwtIssuer, jwtSecret, tokenLifetime } from '../auth/config';
import database from '../database';
import { authUserSchema, toPublicUser } from '../http';
import type { AuthTokenPayload, PublicUser } from '../models';

function readBearerToken(authorization: string | undefined) {
  if (!authorization) {
    return {
      token: null,
      error: '缺少认证令牌。'
    } as const;
  }

  if (!authorization.startsWith('Bearer ')) {
    return {
      token: null,
      error: '认证令牌无效。'
    } as const;
  }

  return {
    token: authorization.slice('Bearer '.length),
    error: null
  } as const;
}

export const authPlugin = new Elysia({ name: 'auth-plugin' })
  .use(
    jwt({
      name: 'accessJwt',
      secret: jwtSecret,
      schema: authUserSchema,
      aud: jwtAudience,
      iss: jwtIssuer,
      exp: tokenLifetime
    })
  )
  .derive({ as: 'global' }, async ({ headers, accessJwt }) => {
    const { token, error } = readBearerToken(headers.authorization);

    if (!token) {
      return {
        authError: error,
        user: null as PublicUser | null
      };
    }

    const payload = await accessJwt.verify(token);

    if (!payload) {
      return {
        authError: '认证令牌无效或已过期。',
        user: null as PublicUser | null
      };
    }

    const currentUser = database.findUserById((payload as AuthTokenPayload).id);

    if (!currentUser || currentUser.uid !== (payload as AuthTokenPayload).uid || currentUser.role !== (payload as AuthTokenPayload).role) {
      return {
        authError: '认证用户不存在或已失效。',
        user: null as PublicUser | null
      };
    }

    return {
      authError: null,
      user: toPublicUser(currentUser)
    };
  });
