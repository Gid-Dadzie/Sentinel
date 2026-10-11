import { createContext, useContext } from 'react';
import type { User } from './types';

export interface AuthState {
  /** "loading" until the first check of the session cookie has answered. */
  status: 'loading' | 'signed-out' | 'signed-in';
  user: User | null;
  /** A problem found while checking the session (e.g. the API is down), for the sign-in page. */
  notice: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

/** The signed-in user and login/logout. Only available inside AuthProvider (API mode). */
export function useAuth(): AuthState {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside AuthProvider');
  return auth;
}

/** The signed-in user, or null in demo mode where there is no sign-in. */
export function useOptionalUser(): User | null {
  return useContext(AuthContext)?.user ?? null;
}
