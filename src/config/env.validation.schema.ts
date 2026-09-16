import * as z from 'zod'

export const envValidationSchema = z.object({
    APP_PORT: z.coerce.number().int().positive().default(3000),
    APP_NODE: z.enum(['development', 'production', 'test']),

    DATABASE_HOST: z.string().min(1),
    DATABASE_PORT: z.coerce.number().int().positive(),
    DATABASE_USER: z.string().min(1),
    DATABASE_PASSWORD: z.string().min(1),
    DATABASE_NAME: z.string().min(1),

    OBSERVE_APP_KEY: z.string().optional(),
    OBSERVE_APP_SECRET: z.string().optional(),
    OBSERVE_SERVICE_ID: z.string().optional(),
})

export const validateEnv = (config: Record<string, unknown>) => {
    const result = envValidationSchema.safeParse(config);

    if (!result.success) {
        const details = result.error.issues
            .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
            .join('\n');

        throw new Error(`Invalid environment variables:\n${details}`);
    }

    return config;
};
