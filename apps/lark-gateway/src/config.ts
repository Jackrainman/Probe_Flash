import { z } from 'zod';

export const ConfigSchema = z.object({
  LARK_APP_ID: z.string().min(1, 'LARK_APP_ID required'),
  LARK_APP_SECRET: z.string().min(1, 'LARK_APP_SECRET required'),
  LARK_BOT_OPEN_ID: z.string().min(1, 'LARK_BOT_OPEN_ID required'),
  LARK_DOMAIN: z.enum(['feishu', 'lark']).default('feishu'),
  PROBEFLASH_SKILL_MODE: z.enum(['mock', 'claude', 'deepseek']).default('mock'),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfigFrom(
  env: Record<string, string | undefined>,
): Config {
  const parsed = ConfigSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    throw new Error(`invalid config: ${issues}`);
  }
  return parsed.data;
}

export function loadConfig(): Config {
  return loadConfigFrom(process.env as Record<string, string | undefined>);
}
