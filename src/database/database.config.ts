import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';


export const databaseConfiguration = (
    config: ConfigService,
): TypeOrmModuleOptions => {
    return {
        type: 'postgres',
        host: config.getOrThrow<string>('database.host'),
        port: config.getOrThrow<number>('database.port'),
        username: config.getOrThrow<string>('database.user'),
        password: config.getOrThrow<string>('database.password'),
        database: config.getOrThrow<string>('database.name'),
        autoLoadEntities: true,
        synchronize: false,
        logging: true,
        migrations: [
            new URL('migrations/**/*{.js,.ts}', import.meta.url).pathname,
        ],
        migrationsRun: false,
        migrationsTableName: 'migrations',
        migrationsTransactionMode: 'all',
    };
};