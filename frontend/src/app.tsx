import { useEffect } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';

import { AppShell } from '@/layout/app-shell';
import { apiRequest, ApiResponseError } from '@/lib/api';
import { SessionProvider, useSession } from '@/lib/auth';
import { getDefaultPathByRole } from '@/lib/session';
import type { AppNotification, StoredUser, UserRole } from '@/lib/types';
import { LoginPage } from '@/features/auth-page';
import {
  StudentAccountPage,
  StudentDashboardPage,
  StudentNotificationsPage,
  StudentUploadPage
} from '@/features/student-pages';
import {
  AccountSettingsPage,
  TeacherDashboardPage,
  TeacherStudentsPage
} from '@/features/teacher-pages';
import {
  AdminAssignmentsPage,
  AdminTeachersPage,
  AdminUsersPage,
  AdminStudentsPage
} from '@/features/admin-pages';

function RootRedirect() {
  const { user } = useSession();
  return <Navigate to={user ? getDefaultPathByRole(user.role) : '/login'} replace />;
}

function RoleLayout({ role }: { role: UserRole }) {
  const { token, user, signOut, setNotificationCount, notificationCount } = useSession();
  const location = useLocation();

  useEffect(() => {
    if (!token || !user) return;
    if (user.role !== 'student') return;

    apiRequest<{ unreadCount: number; notifications: AppNotification[] }>('/student/notifications', {}, token)
      .then((data) => setNotificationCount(data.unreadCount))
      .catch((error) => {
        if (error instanceof ApiResponseError && error.status === 401) signOut();
      });
  }, [location.pathname, setNotificationCount, signOut, token, user]);

  if (!token || !user) return <Navigate to="/login" replace />;

  const allowed = user.role === role || (role === 'teacher' && user.role === 'admin');
  if (!allowed) return <Navigate to={getDefaultPathByRole(user.role)} replace />;

  return <AppShell user={user} notificationCount={notificationCount} />;
}

function LoginGuard() {
  const { user } = useSession();
  return user ? <Navigate to={getDefaultPathByRole(user.role)} replace /> : <LoginPage />;
}

function AdminRecordsRoute() {
  return <TeacherDashboardPage />;
}

export function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<LoginGuard />} />

          <Route path="/student" element={<RoleLayout role="student" />}>
            <Route path="dashboard" element={<StudentDashboardPage />} />
            <Route path="upload" element={<StudentUploadPage />} />
            <Route path="notifications" element={<StudentNotificationsPage />} />
            <Route path="account" element={<StudentAccountPage />} />
          </Route>

          <Route path="/teacher" element={<RoleLayout role="teacher" />}>
            <Route path="dashboard" element={<TeacherDashboardPage />} />
            <Route path="students" element={<TeacherStudentsPage />} />
            <Route path="account" element={<AccountSettingsPage allowNameChange />} />
          </Route>

          <Route path="/admin" element={<RoleLayout role="admin" />}>
            <Route path="records" element={<AdminRecordsRoute />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="assign" element={<AdminAssignmentsPage />} />
            <Route path="students" element={<AdminStudentsPage />} />
            <Route path="teachers" element={<AdminTeachersPage />} />
            <Route path="account" element={<AccountSettingsPage allowNameChange />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  );
}
