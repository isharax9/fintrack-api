import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  ACCESS_TOKEN_SECRET: z.string().min(1),
  REFRESH_TOKEN_SECRET: z.string().min(1),
  ACCESS_TOKEN_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().default(12),
  SMTP_HOST: z.string(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string(),
  SMTP_PASS: z.string(),
  EMAIL_FROM: z.string().default('FinTrack <noreply@fintrack.dev>'),
  APP_NAME: z.string().default('FinTrack'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  PORT: z.coerce.number().default(5000),
});

export type EnvVars = z.infer<typeof envSchema>;

let envVars: EnvVars;

try {
  envVars = envSchema.parse(process.env);
} catch (error) {
  console.error("Environment Variable Validation Error:");
  if (error instanceof z.ZodError) {
    console.error(error.errors);
  }
  // Allow continuing without crash since Fastify/env plugin will also validate
  envVars = process.env as any;
}

export const env = envVars;
