import { ClipboardList, LogOut } from 'lucide-react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth';
import { useSiteName } from '@/lib/runtime-config';
import { SiteFooter } from '@/shared/site-footer';
import type { StoredUser, UserRole } from '@/lib/types';
import { cn } from '@/lib/utils';

const navMap: Record<UserRole, Array<{ to: string; label: string }>> = {
  student: [
    { to: '/student/dashboard', label: '数据概览' },
    { to: '/student/tasks', label: '任务列表' },
    { to: '/student/notifications', label: '消息通知' },
    { to: '/student/account', label: '账号设置' }
  ],
  teacher: [
    { to: '/teacher/dashboard', label: '数据概览' },
    { to: '/teacher/tasks', label: '任务管理' },
    { to: '/teacher/students', label: '学生列表' },
    { to: '/teacher/account', label: '账号设置' }
  ],
  admin: [
    { to: '/admin/dashboard', label: '数据概览' },
    { to: '/admin/tasks', label: '任务管理' },
    { to: '/admin/users', label: '用户创建' },
    { to: '/admin/assign', label: '班级管理' },
    { to: '/admin/students', label: '学生列表' },
    { to: '/admin/teachers', label: '教师列表' },
    { to: '/admin/account', label: '账号设置' }
  ]
};

const roleTitleMap: Record<UserRole, string> = {
  admin: '管理员后台',
  teacher: '教师工作台',
  student: '学生中心'
};

export function AppShell({
  user,
  notificationCount = 0
}: {
  user: StoredUser;
  notificationCount?: number;
}) {
  const navigate = useNavigate();
  const items = navMap[user.role];
  const { signOut } = useSession();
  const roleTitle = roleTitleMap[user.role];
  const siteName = useSiteName();

  function handleSignOut() {
    signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80 lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <ClipboardList className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs text-muted-foreground">{siteName}</p>
              <p className="truncate text-base font-bold tracking-tight">{roleTitle}</p>
            </div>
          </Link>
          <div className="flex min-w-0 items-center gap-2">
            <div className="hidden min-w-0 text-right text-xs sm:block">
              <p className="truncate font-medium">{user.name}</p>
              <p className="truncate text-muted-foreground">{user.uid}</p>
            </div>
            <Button variant="ghost" size="icon-sm" className="shrink-0" onClick={handleSignOut}>
              <LogOut className="size-4" />
              <span className="sr-only">退出登录</span>
            </Button>
          </div>
        </div>
        <nav className="scrollbar-none flex gap-1 overflow-x-auto px-3 pb-2">
          {items.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-4xl px-3 text-sm font-medium whitespace-nowrap transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )
              }
            >
              {label}
              {user.role === 'student' && to === '/student/notifications' ? (
                <NotificationBadgeInline count={notificationCount} />
              ) : null}
            </NavLink>
          ))}
        </nav>
      </header>

      <aside className="hidden h-screen w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground lg:sticky lg:top-0 lg:flex">
        <div className="flex h-full flex-col overflow-y-auto">
          <Link to="/" className="flex min-h-20 items-center gap-3 px-5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-sidebar-primary text-sidebar-primary-foreground">
              <ClipboardList className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm text-muted-foreground">{siteName}</p>
              <p className="truncate text-base font-bold tracking-tight">{roleTitle}</p>
            </div>
          </Link>

          <nav className="flex flex-1 flex-col gap-1 px-3 py-3">
            {items.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'group flex min-h-10 items-center justify-between rounded-4xl px-4 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground'
                  )
                }
              >
                <span className="truncate">{label}</span>
                {user.role === 'student' && to === '/student/notifications' ? (
                  <NotificationBadgeInline count={notificationCount} />
                ) : null}
              </NavLink>
            ))}
          </nav>

          <div className="border-t px-4 py-4">
            <div className="min-w-0 px-1 pb-3">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">UID: {user.uid}</p>
            </div>
            <Button variant="ghost" className="w-full justify-start px-3" onClick={handleSignOut}>
              <LogOut className="size-4" />
              退出登录
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col px-4 py-5 sm:px-5 md:px-6 lg:px-8 lg:py-6">
        <div className="mx-auto flex w-full max-w-[1220px] flex-1 flex-col">
          <Outlet />
          <SiteFooter className="mt-auto pt-8" />
        </div>
      </main>
    </div>
  );
}

function NotificationBadgeInline({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <Badge variant="destructive" className="ml-1 h-5 min-w-5 justify-center px-1 text-[10px] leading-none">
      {count > 99 ? '99+' : count}
    </Badge>
  );
}
