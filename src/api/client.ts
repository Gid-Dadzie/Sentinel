/**
 * Talks to the Sentinel API. Requests go to the same origin (/api/...): in development
 * Vite forwards them to the API server, so the session cookie just works.
 */

/** True when the app runs against the API (`npm run dev:api`) instead of demo data. */
export const API_MODE = import.meta.env.VITE_DATA_SOURCE === 'api';

export const API_UNREACHABLE =
  'Cannot reach the Sentinel API. Start it with "npm run dev -w @sentinel/server", then try again.';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Field problems or a list of messages, as the API sends them. */
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { credentials: 'same-origin', ...init });
  } catch {
    throw new ApiError(0, API_UNREACHABLE);
  }
  if (res.status === 204) return undefined as T;

  const body: unknown = await res.json().catch(() => null);
  // The API always answers in JSON. A server error without JSON means the request never
  // reached it: in development, Vite's proxy answers 500 when the API is not running.
  if (res.status >= 500 && body === null) throw new ApiError(res.status, API_UNREACHABLE);
  if (!res.ok) {
    const error = body && typeof body === 'object' && 'error' in body ? body.error : undefined;
    const details =
      body && typeof body === 'object' && 'details' in body ? body.details : undefined;
    throw new ApiError(
      res.status,
      typeof error === 'string' ? error : `Request failed (${res.status})`,
      details,
    );
  }
  return body as T;
}

/** JSON body helper: `apiFetch(path, json('POST', data))`. */
export function json(method: string, data: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
}
