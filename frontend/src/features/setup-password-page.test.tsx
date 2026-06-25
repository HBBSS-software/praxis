// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import type { StoredUser } from '@/lib/types';

const { mockSession, mockSignOut } = vi.hoisted(() => ({
  mockSession: {
    current: null as null | {
      user: StoredUser | null;
      loading: boolean;
      passwordSetupCurrentPassword: string | null;
      notificationCount: number;
      signIn: ReturnType<typeof vi.fn>;
      signOut: ReturnType<typeof vi.fn>;
      updateUser: ReturnType<typeof vi.fn>;
      setNotificationCount: ReturnType<typeof vi.fn>;
    }
  },
  mockSignOut: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  useSession: () => mockSession.current
}));

vi.mock('@/lib/api', () => ({
  ApiResponseError: class ApiResponseError extends Error {
    status: number;

    constructor(status: number) {
      super();
      this.status = status;
    }
  },
  createApiClient: vi.fn(),
  unwrapResponse: vi.fn(),
  validatePlainPassword: vi.fn(() => null)
}));

vi.mock('@/lib/feedback', () => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn()
}));

import { SetupPasswordPage } from './setup-password-page';

const passwordSetupUser: StoredUser = {
  id: 1,
  uid: 1,
  role: 'student',
  name: '张三',
  english_name: null,
  password_setup_required: true
};

function setMockSession(passwordSetupCurrentPassword: string | null) {
  mockSession.current = {
    user: passwordSetupUser,
    loading: false,
    passwordSetupCurrentPassword,
    notificationCount: 0,
    signIn: vi.fn(),
    signOut: mockSignOut,
    updateUser: vi.fn(),
    setNotificationCount: vi.fn()
  };
}

function renderSetupPasswordPage() {
  render(
    <MemoryRouter initialEntries={['/setup-password']}>
      <Routes>
        <Route path="/setup-password" element={<SetupPasswordPage />} />
        <Route path="/login" element={<div>登录页</div>} />
      </Routes>
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  mockSession.current = null;
  vi.clearAllMocks();
});

describe('SetupPasswordPage', () => {
  test('shows setup form when current password is available', () => {
    setMockSession('initial-pass');

    renderSetupPasswordPage();

    expect(screen.getByText('设置密码')).toBeTruthy();
    expect(screen.getByText('UID：')).toBeTruthy();
    expect(screen.getByText('张三')).toBeTruthy();
  });

  test('signs out and returns to login when current password is unavailable', async () => {
    setMockSession(null);

    renderSetupPasswordPage();

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText('登录页')).toBeTruthy();
  });
});
