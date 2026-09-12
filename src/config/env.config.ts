export const EnvConfig = () => ({
    app: {
        port: Number(process.env.APP_PORT),
        env: process.env.APP_NODE,
    },
    observe: {
        appKey: process.env.OBSERVE_APP_KEY,
        appSecret: process.env.OBSERVE_APP_SECRET,
        serviceId: process.env.OBSERVE_SERVICE_ID,
    },
})