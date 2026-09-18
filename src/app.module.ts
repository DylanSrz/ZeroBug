import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EnvConfig, envValidationSchema, databaseConfiguration } from './config/index.js';
import { TypeOrmModule } from '@nestjs/typeorm'
import { TableModule } from './table/table.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [EnvConfig],
      validationSchema: envValidationSchema
    }),
    ObserveModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (observeConfig: ConfigService) => ({
        ...observeConfig.getOrThrow('observe')
      })
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule,],
      inject: [ConfigService],
      useFactory: databaseConfiguration,
    }),
    TableModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
