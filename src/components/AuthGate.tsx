import type { ReactNode } from 'react';
import { useAuth } from '../api/auth';
import Login from '../pages/Login';

/** In API mode, shows the sign-in page until there is a session. */
export default function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === 'loading') {
    return (
      <p role="status" style={{ padding: '2rem' }}>
        Loading…
      </p>
    );
  }
  return status === 'signed-in' ? children : <Login />;
}
