import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Role } from '../api/types';
import { useOptionalUser } from '../api/auth';
import PageHeader from './PageHeader';
import shared from './shared.module.css';

/** Shows the page only to the given roles; the API enforces the same rule. */
export default function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const user = useOptionalUser();
  if (user?.role === role) return children;
  return (
    <div className={shared.page}>
      <PageHeader title="Not available" />
      <div className={`${shared.card} ${shared.empty}`}>
        <Lock size={28} aria-hidden="true" />
        <p>This page is for {role}s. Ask an admin if you need access.</p>
      </div>
    </div>
  );
}
