import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AuthContext, type AuthState } from './auth';
import { ApiError, apiFetch, json } from './client';
import type { User } from './types';

/** Checks the session once on load, then tracks sign-in and sign-out. */
export default function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ user: User }>('/api/auth/me')
      .then(({ user: me }) => {
        if (cancelled) return;
        setUser(me);
        setStatus('signed-in');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        // 401 just means "not signed in"; anything else is shown on the sign-in page.
        if (!(error instanceof ApiError) || error.status !== 401) {
          setNotice(error instanceof Error ? error.message : 'Something went wrong.');
        }
        setStatus('signed-out');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { user: me } = await apiFetch<{ user: User }>(
      '/api/auth/login',
      json('POST', { email, password }),
    );
    setUser(me);
    setNotice(null);
    setStatus('signed-in');
  }, []);

  const logout = useCallback(async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setUser(null);
    setStatus('signed-out');
  }, []);

  const value = useMemo(
    () => ({ status, user, notice, login, logout }),
    [status, user, notice, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
