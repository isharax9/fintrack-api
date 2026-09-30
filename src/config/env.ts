import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  ACCESS_TOKEN_SECRET: z.string().min(1),
  REFRESH_TOKEN_SECRET: z.string().min(1),
  ACCESS_TOKEN_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().default(12),
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().default('FinTrack <noreply@fintrack.dev>'),
  APP_NAME: z.string().default('FinTrack'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  LOG_LEVEL: z.string().default('info'),
  TRUST_PROXY: z.coerce.boolean().default(false),
  ENABLE_CRON: z.coerce.boolean().default(false),
  PORT: z.coerce.number().default(5000),
}).superRefine((data, ctx) => {
  if (data.NODE_ENV === 'production') {
    if (data.ACCESS_TOKEN_SECRET.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'ACCESS_TOKEN_SECRET must be at least 32 characters in production',
        path: ['ACCESS_TOKEN_SECRET'],
      });
    }
    if (data.REFRESH_TOKEN_SECRET.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'REFRESH_TOKEN_SECRET must be at least 32 characters in production',
        path: ['REFRESH_TOKEN_SECRET'],
      });
    }
  }
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
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
  // Allow continuing without crash since Fastify/env plugin will also validate
  envVars = process.env as any;
}

export const env = envVars;
