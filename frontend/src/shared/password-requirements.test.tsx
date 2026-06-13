// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { PasswordRequirements } from './password-requirements';

afterEach(cleanup);

describe('PasswordRequirements', () => {
  test('shows password requirements in production', () => {
    render(<PasswordRequirements password="Abcdef1!" isProduction />);

    expect(screen.getByLabelText('密码要求')).toBeTruthy();
    expect(screen.getByText('8 到 32 位')).toBeTruthy();
    expect(screen.getByText('包含大写字母')).toBeTruthy();
    expect(screen.getByText('包含小写字母')).toBeTruthy();
    expect(screen.getByText('包含数字')).toBeTruthy();
    expect(screen.getByText('包含特殊符号')).toBeTruthy();
  });

  test('hides password requirements outside production', () => {
    render(<PasswordRequirements password="Abcdef1!" isProduction={false} />);

    expect(screen.queryByLabelText('密码要求')).toBeNull();
  });
});
