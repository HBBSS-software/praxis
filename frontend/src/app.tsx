import { Suspense, lazy, useEffect, type ComponentType, type ReactNode } from 'react';
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';

import { AppShell } from '@/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { ApiResponseError, createApiClient, unwrapResponse } from '@/lib/api';
import { SessionProvider, useSession } from '@/lib/auth';
import { RuntimeConfigProvider } from '@/lib/runtime-config';
import { getDefaultPathByRole, getPasswordSetupPath } from '@/lib/session';
import type { AppNotification, StoredUser, UserRole } from '@/lib/types';
import { Toaster } from '@/components/ui/sonner';

function lazyPage<TModule extends Record<string, unknown>>(
  loader: () => Promise<TModule>,
  exportName: keyof TModule
) {
  return lazy(async () => {
    const module = await loader();
    return {
      default: module[exportName] as ComponentType<any>
    };
  });
}

const LoginPage = lazyPage(() => import('@/features/auth-page'), 'LoginPage');
const StudentLoginPage = lazyPage(() => import('@/features/auth-page'), 'StudentLoginPage');
const StaffLoginPage = lazyPage(() => import('@/features/auth-page'), 'StaffLoginPage');
const SetupPasswordPage = lazyPage(() => import('@/features/setup-password-page'), 'SetupPasswordPage');
const StudentDashboardPage = lazyPage(() => import('@/features/student'), 'StudentDashboardPage');
const StudentTasksPage = lazyPage(() => import('@/features/student'), 'StudentTasksPage');
const StudentUploadPage = lazyPage(() => import('@/features/student'), 'StudentUploadPage');
const StudentTaskPage = lazyPage(() => import('@/features/student'), 'StudentTaskPage');
const StudentNotificationsPage = lazyPage(() => import('@/features/student'), 'StudentNotificationsPage');
const StudentAccountPage = lazyPage(() => import('@/features/student'), 'StudentAccountPage');
const TeacherDashboardPage = lazyPage(() => import('@/features/teacher'), 'TeacherDashboardPage');
const TeacherTasksPage = lazyPage(() => import('@/features/teacher'), 'TeacherTasksPage');
const TeacherTaskPage = lazyPage(() => import('@/features/teacher'), 'TeacherTaskPage');
const TeacherRecordEditPage = lazyPage(() => import('@/features/teacher'), 'TeacherRecordEditPage');
const TeacherStudentsPage = lazyPage(() => import('@/features/teacher'), 'TeacherStudentsPage');
const AccountSettingsPage = lazyPage(() => import('@/features/teacher'), 'AccountSettingsPage');
const AdminAssignmentsPage = lazyPage(() => import('@/features/admin'), 'AdminAssignmentsPage');
const AdminTeachersPage = lazyPage(() => import('@/features/admin'), 'AdminTeachersPage');
const AdminUsersPage = lazyPage(() => import('@/features/admin'), 'AdminUsersPage');
const AdminStudentsPage = lazyPage(() => import('@/features/admin'), 'AdminStudentsPage');

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner className="size-5" />
    </div>
  );
}

function DeferredRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

function NotFoundPage() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-5xl font-semibold">404</h1>
      <p className="text-muted-foreground">页面不存在。</p>
      <Button asChild>
        <Link to="/">返回主页</Link>
      </Button>
    </main>
  );
}

function RootRedirect() {
  const { user, loading } = useSession();
  if (loading) return <RouteFallback />;
  return <Navigate to={user ? getDefaultPathByRole(user.role, user.password_setup_required) : '/login'} replace />;
}

function RoleLayout({ role }: { role: UserRole }) {
  const { user, loading, signOut, setNotificationCount, notificationCount } = useSession();
  const location = useLocation();

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'student') return;
    if (user.password_setup_required) return;

    unwrapResponse<{ unreadCount: number; notifications: AppNotification[] }>(createApiClient().student.notifications.get())
      .then((data) => setNotificationCount(data.unreadCount))
      .catch((error) => {
        if (error instanceof ApiResponseError && error.status === 401) signOut();
      });
  }, [location.pathname, setNotificationCount, signOut, user]);

  if (loading) return <RouteFallback />;
  if (!user) return <Navigate to="/login" replace />;

  const allowed = user.role === role || (role === 'teacher' && user.role === 'admin');
  if (!allowed) return <Navigate to={getDefaultPathByRole(user.role, user.password_setup_required)} replace />;

  if (user.password_setup_required) {
    return <Navigate to={getPasswordSetupPath()} replace />;
  }

  return <AppShell user={user} notificationCount={notificationCount} />;
}

function LoginGuard() {
  const { user, loading } = useSession();
  if (loading) return <RouteFallback />;
  return user ? <Navigate to={getDefaultPathByRole(user.role, user.password_setup_required)} replace /> : <DeferredRoute><LoginPage /></DeferredRoute>;
}

function StudentLoginGuard() {
  const { user, loading } = useSession();
  if (loading) return <RouteFallback />;
  return user ? <Navigate to={getDefaultPathByRole(user.role, user.password_setup_required)} replace /> : <DeferredRoute><StudentLoginPage /></DeferredRoute>;
}

function StaffLoginGuard() {
  const { user, loading } = useSession();
  if (loading) return <RouteFallback />;
  return user ? <Navigate to={getDefaultPathByRole(user.role, user.password_setup_required)} replace /> : <DeferredRoute><StaffLoginPage /></DeferredRoute>;
}

export function App() {
  return (
    <SessionProvider>
      <RuntimeConfigProvider>
        <BrowserRouter>
          <Toaster />
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<LoginGuard />} />
            <Route path="/login/student" element={<StudentLoginGuard />} />
            <Route path="/login/staff" element={<StaffLoginGuard />} />
            <Route path="/setup-password" element={<DeferredRoute><SetupPasswordPage /></DeferredRoute>} />

            <Route path="/student" element={<RoleLayout role="student" />}>
              <Route path="dashboard" element={<DeferredRoute><StudentDashboardPage /></DeferredRoute>} />
              <Route path="tasks" element={<DeferredRoute><StudentTasksPage /></DeferredRoute>} />
              <Route path="tasks/:id" element={<DeferredRoute><StudentTaskPage /></DeferredRoute>} />
              <Route path="tasks/:taskId/upload" element={<DeferredRoute><StudentUploadPage /></DeferredRoute>} />
              <Route path="notifications" element={<DeferredRoute><StudentNotificationsPage /></DeferredRoute>} />
              <Route path="account" element={<DeferredRoute><StudentAccountPage /></DeferredRoute>} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>

            <Route path="/teacher" element={<RoleLayout role="teacher" />}>
              <Route path="dashboard" element={<DeferredRoute><TeacherDashboardPage /></DeferredRoute>} />
              <Route path="tasks" element={<DeferredRoute><TeacherTasksPage /></DeferredRoute>} />
              <Route path="tasks/:id" element={<DeferredRoute><TeacherTaskPage /></DeferredRoute>} />
              <Route path="tasks/:id/records/:recordId/edit" element={<DeferredRoute><TeacherRecordEditPage /></DeferredRoute>} />
              <Route path="students" element={<DeferredRoute><TeacherStudentsPage /></DeferredRoute>} />
              <Route path="account" element={<DeferredRoute><AccountSettingsPage allowNameChange /></DeferredRoute>} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>

            <Route path="/admin" element={<RoleLayout role="admin" />}>
              <Route path="dashboard" element={<DeferredRoute><TeacherDashboardPage /></DeferredRoute>} />
              <Route path="tasks" element={<DeferredRoute><TeacherTasksPage /></DeferredRoute>} />
              <Route path="tasks/:id" element={<DeferredRoute><TeacherTaskPage /></DeferredRoute>} />
              <Route path="tasks/:id/records/:recordId/edit" element={<DeferredRoute><TeacherRecordEditPage /></DeferredRoute>} />
              <Route path="users" element={<DeferredRoute><AdminUsersPage /></DeferredRoute>} />
              <Route path="assign" element={<DeferredRoute><AdminAssignmentsPage /></DeferredRoute>} />
              <Route path="students" element={<DeferredRoute><AdminStudentsPage /></DeferredRoute>} />
              <Route path="teachers" element={<DeferredRoute><AdminTeachersPage /></DeferredRoute>} />
              <Route path="account" element={<DeferredRoute><AccountSettingsPage allowNameChange /></DeferredRoute>} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </RuntimeConfigProvider>
    </SessionProvider>
  );
}
