import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { clearSession, getStoredUser, getToken, storeSession } from '@/lib/session';
import type { StoredUser } from '@/lib/types';

interface SessionValue {
  token: string | null;
  user: StoredUser | null;
  notificationCount: number;
  signIn: (token: string, user: StoredUser) => void;
  signOut: () => void;
  setNotificationCount: (count: number) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getToken());
  const [user, setUser] = useState<StoredUser | null>(() => getStoredUser());
  const [notificationCount, setNotificationCount] = useState(0);

  const value = useMemo(
    () => ({
      token,
      user,
      notificationCount,
      signIn: (nextToken: string, nextUser: StoredUser) => {
        storeSession(nextToken, nextUser);
        setToken(nextToken);
        setUser(nextUser);
      },
      signOut: () => {
        clearSession();
        setToken(null);
        setUser(null);
        setNotificationCount(0);
      },
      setNotificationCount
    }),
    [notificationCount, token, user]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('Missing session context');
  return value;
}
