import { AlertTriangle, RotateCw } from 'lucide-react';
import type { ApiError } from '../api/client';
import PageHeader from './PageHeader';
import shared from './shared.module.css';

/** A whole page waiting for its data. */
export function PageLoading({ title }: { title: string }) {
  return (
    <div className={shared.page} aria-busy="true">
      <PageHeader title={title} />
      <p role="status" className={shared.muted}>
        Loading…
      </p>
    </div>
  );
}

/** What went wrong, with a way to try again. */
export function LoadProblem({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  return (
    <div className={shared.empty} role="alert">
      <AlertTriangle size={28} aria-hidden="true" />
      <span>{error.message}</span>
      <button type="button" className={shared.button} onClick={onRetry}>
        <RotateCw size={15} aria-hidden="true" />
        Try again
      </button>
    </div>
  );
}

/** A whole page that could not load. */
export function PageProblem({
  title,
  error,
  onRetry,
}: {
  title: string;
  error: ApiError;
  onRetry: () => void;
}) {
  return (
    <div className={shared.page}>
      <PageHeader title={title} />
      <div className={shared.card}>
        <LoadProblem error={error} onRetry={onRetry} />
      </div>
    </div>
  );
}
