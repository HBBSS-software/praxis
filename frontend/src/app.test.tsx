// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { StoredUser } from '@/lib/types';

const sessionState = vi.hoisted(() => ({
  current: null as {
    user: StoredUser | null;
    loading: boolean;
    passwordSetupCurrentPassword: string | null;
    notificationCount: number;
    signIn: ReturnType<typeof vi.fn>;
    signOut: ReturnType<typeof vi.fn>;
    updateUser: ReturnType<typeof vi.fn>;
    setNotificationCount: ReturnType<typeof vi.fn>;
  } | null
}));

vi.mock('@/lib/auth', () => ({
  SessionProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useSession: () => {
    if (!sessionState.current) throw new Error('Missing mocked session');
    return sessionState.current;
  }
}));

vi.mock('@/layout/app-shell', async () => {
  const { Outlet, useLocation } = await import('react-router-dom');
  return {
    AppShell: ({ user }: { user: StoredUser }) => {
      const location = useLocation();
      return (
        <div>
          <div data-testid="app-shell">{user.role}:{location.pathname}</div>
          <Outlet />
        </div>
      );
    }
  };
});

vi.mock('@/components/ui/sonner', () => ({
  Toaster: () => null
}));

vi.mock('@/lib/runtime-config', () => ({
  RuntimeConfigProvider: ({ children }: { children: ReactNode }) => <>{children}</>
}));

vi.mock('@/features/auth-page', () => ({
  LoginPage: () => <div>登录页</div>,
  StudentLoginPage: () => <div>学生登录页</div>,
  StaffLoginPage: () => <div>教师登录页</div>
}));

vi.mock('@/features/setup-password-page', () => ({
  SetupPasswordPage: () => <div>设置密码</div>
}));

vi.mock('@/features/student', () => ({
  StudentDashboardPage: () => <div>学生首页</div>,
  StudentTasksPage: () => <div>学生任务</div>,
  StudentTaskPage: () => <div>学生任务详情</div>,
  StudentUploadPage: () => <div>学生上传</div>,
  StudentNotificationsPage: () => <div>学生通知</div>,
  StudentAccountPage: () => <div>学生账号</div>
}));

vi.mock('@/features/teacher', () => ({
  TeacherDashboardPage: () => <div>教师首页</div>,
  TeacherTasksPage: () => <div>教师任务</div>,
  TeacherTaskPage: () => <div>教师任务详情</div>,
  TeacherRecordEditPage: () => <div>教师记录编辑</div>,
  TeacherStudentsPage: () => <div>教师学生</div>,
  AccountSettingsPage: () => <div>账号设置</div>
}));

vi.mock('@/features/admin', () => ({
  AdminAssignmentsPage: () => <div>管理员分配</div>,
  AdminTeachersPage: () => <div>管理员教师</div>,
  AdminUsersPage: () => <div>管理员用户</div>,
  AdminStudentsPage: () => <div>管理员学生</div>
}));

import { App } from './app';

const teacherUser: StoredUser = {
  id: 2,
  uid: 2,
  role: 'teacher',
  name: '教师',
  english_name: null,
  password_setup_required: false
};

const adminUser: StoredUser = {
  ...teacherUser,
  id: 1,
  uid: 1,
  role: 'admin',
  name: '管理员'
};

function setSession(overrides: Partial<NonNullable<typeof sessionState.current>> = {}) {
  sessionState.current = {
    user: null,
    loading: false,
    passwordSetupCurrentPassword: null,
    notificationCount: 0,
    signIn: vi.fn(),
    signOut: vi.fn(),
    updateUser: vi.fn(),
    setNotificationCount: vi.fn(),
    ...overrides
  };
}

function renderAt(path: string) {
  window.history.pushState({}, '', path);
  return render(<App />);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  setSession();
});

describe('App route guards', () => {
  test('waits for session loading before redirecting protected routes', () => {
    setSession({ loading: true });
    renderAt('/teacher/tasks/1');

    expect(window.location.pathname).toBe('/teacher/tasks/1');
    expect(screen.getByRole('status', { name: 'Loading' })).toBeTruthy();
    expect(screen.queryByText('登录页')).toBeNull();
  });

  test('keeps the current protected route after session resolves', async () => {
    setSession({ user: teacherUser });
    renderAt('/teacher/tasks/1');

    await screen.findByText('教师任务详情');
    expect(window.location.pathname).toBe('/teacher/tasks/1');
    expect(screen.getByTestId('app-shell').textContent).toBe('teacher:/teacher/tasks/1');
  });

  test('redirects unauthenticated protected routes after loading finishes', async () => {
    renderAt('/teacher/tasks/1');

    await waitFor(() => {
      expect(window.location.pathname).toBe('/login');
    });
    expect(await screen.findByText('登录页')).toBeTruthy();
  });

  test('redirects logged-in users away from login routes after loading finishes', async () => {
    setSession({ user: adminUser });
    renderAt('/login');

    await waitFor(() => {
      expect(window.location.pathname).toBe('/admin/dashboard');
    });
    expect(await screen.findByText('教师首页')).toBeTruthy();
  });

  test('shows a 404 page for unknown public routes', () => {
    renderAt('/missing-page');

    expect(screen.getByText('404')).toBeTruthy();
    expect(screen.getByText('页面不存在。')).toBeTruthy();
    expect(screen.getByRole('link', { name: '返回主页' }).getAttribute('href')).toBe('/');
    expect(window.location.pathname).toBe('/missing-page');
  });

  test('shows a 404 page for unknown authenticated child routes', () => {
    setSession({ user: teacherUser });
    renderAt('/teacher/missing-page');

    expect(screen.getByText('404')).toBeTruthy();
    expect(screen.getByText('页面不存在。')).toBeTruthy();
    expect(screen.getByRole('link', { name: '返回主页' }).getAttribute('href')).toBe('/');
    expect(window.location.pathname).toBe('/teacher/missing-page');
  });
});
