import { vi } from 'vitest';

type Handler = (url: URL, init: RequestInit | undefined) => { status: number; body?: unknown };

/** Replaces fetch with a function that answers from `handler`, and records every call. */
export function fakeApi(handler: Handler) {
  const calls: { url: URL; init: RequestInit | undefined }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = new URL(input, 'http://localhost');
      calls.push({ url, init });
      const { status, body } = handler(url, init);
      return new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
  return calls;
}
