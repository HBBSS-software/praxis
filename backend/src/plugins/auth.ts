import { jwt } from '@elysiajs/jwt';
import { Elysia } from 'elysia';

import { jwtAudience, jwtIssuer, jwtSecret, tokenLifetime } from '../auth/config';
import { authUserSchema } from '../http';
import type { AuthTokenPayload } from '../models';

function readToken(authorization: string | undefined) {
  if (!authorization) {
    return { token: null, error: '缺少认证令牌。' } as const;
  }

  if (!authorization.startsWith('Bearer ')) {
    return { token: null, error: '认证令牌无效。' } as const;
  }

  return { token: authorization.slice('Bearer '.length), error: null } as const;
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
    const { token, error } = readToken(headers.authorization);

    if (!token) {
      return {
        authError: error,
        user: null as AuthTokenPayload | null
      };
    }

    const payload = await accessJwt.verify(token);

    if (!payload) {
      return {
        authError: '认证令牌无效或已过期。',
        user: null as AuthTokenPayload | null
      };
    }

    return {
      authError: null,
      user: payload as AuthTokenPayload
    };
  });
