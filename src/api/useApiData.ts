import { useCallback, useContext, useEffect, useState } from 'react';
import { AuthContext } from './auth';
import { ApiError, apiFetch } from './client';

export interface ApiData<T> {
  /** The answer for the current path (with keepPrevious, the last answer while it loads). */
  data: T | undefined;
  /** True until the answer for the current path has arrived. */
  loading: boolean;
  error: ApiError | null;
  reload: () => void;
  /** Updates the data locally after a change the server has confirmed. */
  setData: (update: (current: T) => T) => void;
}

interface Loaded<T> {
  key: string;
  data?: T;
  error: ApiError | null;
}

/**
 * GETs `path` and fetches again whenever it changes. A 401 returns to the sign-in page.
 * keepPrevious keeps showing the last answer while a new path loads (paging a table).
 * A null path waits (for example, until another request says what to ask for).
 */
export function useApiData<T>(path: string | null, { keepPrevious = false } = {}): ApiData<T> {
  const expire = useContext(AuthContext)?.expire;
  const [version, setVersion] = useState(0);
  const key = `${version}:${path ?? ''}`;
  const [loaded, setLoaded] = useState<Loaded<T>>({ key: '', error: null });

  useEffect(() => {
    if (path === null) return undefined;
    const controller = new AbortController();
    apiFetch<T>(path, { signal: controller.signal }).then(
      (data) => setLoaded({ key, data, error: null }),
      (error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) expire?.();
        setLoaded((previous) => ({
          key,
          data: previous.data,
          error: error instanceof ApiError ? error : new ApiError(0, 'Something went wrong.'),
        }));
      },
    );
    return () => controller.abort();
  }, [path, key, expire]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const setData = useCallback(
    (update: (current: T) => T) =>
      setLoaded((previous) =>
        previous.data === undefined ? previous : { ...previous, data: update(previous.data) },
      ),
    [],
  );

  // A reload of the same path keeps showing what is there until the new answer arrives.
  const current =
    keepPrevious || loaded.key === key || (path !== null && loaded.key.endsWith(`:${path}`));
  return {
    data: current ? loaded.data : undefined,
    loading: loaded.key !== key,
    error: loaded.key === key ? loaded.error : null,
    reload,
    setData,
  };
}
