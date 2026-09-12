import * as z from 'zod'

export const envValidationSchema = z.object({
    APP_PORT: z.coerce.number().int().positive().default(3000),
    APP_NODE: z.preprocess(
        value => (value === '' || value === undefined ? 'development' : value),
        z.enum(['development', 'production', 'test'])
    ),

    OBSERVE_APP_KEY: z.string().min(1),
    OBSERVE_APP_SECRET: z.string().min(1),
    OBSERVE_SERVICE_ID: z.string().min(1),
})
