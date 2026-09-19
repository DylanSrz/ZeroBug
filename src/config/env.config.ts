export const EnvConfig = () => ({
  app: {
    port: Number(process.env.APP_PORT),
    env: process.env.NODE_ENV,
    corsOrigins: (process.env.CORS_ORIGIN ?? '*')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  },
  database: {
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    name: process.env.DATABASE_NAME,
  },
  observe: {
    appKey: process.env.OBSERVE_APP_KEY,
    appSecret: process.env.OBSERVE_APP_SECRET,
    serviceId: process.env.OBSERVE_SERVICE_ID,
  },
});
