import * as z from 'zod';

// Fuente única de verdad de las variables de entorno.
// Lo usan ConfigModule (app.module.ts, opción `validate`) y la CLI de TypeORM (data-source.ts).
// Una variable obligatoria ausente o inválida detiene el arranque (RN-002, RN-013).
export const envValidationSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  APP_PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_HOST: z.string().min(1),
  DATABASE_PORT: z.coerce.number().int().positive().default(5432),
  DATABASE_USER: z.string().min(1),
  DATABASE_PASSWORD: z.string().min(1),
  DATABASE_NAME: z.string().min(1),

  OBSERVE_APP_KEY: z.string().optional(),
  OBSERVE_APP_SECRET: z.string().optional(),
  OBSERVE_SERVICE_ID: z.string().optional(),
});

export type Env = z.infer<typeof envValidationSchema>;

export const validateEnv = (config: Record<string, unknown>): Env => {
  const result = envValidationSchema.safeParse(config);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(`Variables de entorno inválidas:\n${details}`);
  }

  return result.data;
};
