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

/** Turns schema problems into a 400 listing each one by field. */
function parse<T extends z.ZodTypeAny>(input: unknown, schema: T): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new HttpError(
      400,
      'Invalid request',
      result.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
    );
  }
  return result.data;
}

/** Parses the JSON body against a schema, or throws a 400 listing each problem. */
export function parseBody<T extends z.ZodTypeAny>(req: Request, schema: T): z.infer<T> {
  return parse(req.body, schema);
}

/** Parses the query string against a schema, or throws a 400 listing each problem. */
export function parseQuery<T extends z.ZodTypeAny>(req: Request, schema: T): z.infer<T> {
  return parse(req.query, schema);
}
