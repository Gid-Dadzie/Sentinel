import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z
    .string()
    .url()
    .refine((url) => /^postgres(ql)?:\/\//.test(url), 'must be a postgresql:// URL'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
});

export type Config = z.infer<typeof configSchema>;

/**
 * Reads settings from the environment and fails fast with every problem listed,
 * so a missing variable never surfaces later as a confusing runtime error.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = configSchema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid server configuration (see server/.env.example):\n${problems}`);
  }
  return result.data;
}
