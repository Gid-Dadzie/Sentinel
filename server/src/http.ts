import type { Request } from 'express';
import type { z } from 'zod';

/** An error with a status code and a message that is safe to show the client. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

/** Parses the JSON body against a schema, or throws a 400 listing each problem. */
export function parseBody<T extends z.ZodTypeAny>(req: Request, schema: T): z.infer<T> {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    throw new HttpError(
      400,
      'Invalid request',
      result.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
    );
  }
  return result.data;
}
