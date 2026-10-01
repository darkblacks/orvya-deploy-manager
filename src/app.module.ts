import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { RepositoriesModule } from './repositories/repositories.module';
import { DeploymentsModule } from './deployments/deployments.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { RepositoryEntity } from './repositories/repository.entity';
import { DeploymentEntity } from './deployments/deployment.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', '127.0.0.1'),
        port: Number(config.get<string>('DB_PORT', '5435')),
        username: config.get<string>('DB_USERNAME', 'deploy_manager'),
        password: config.get<string>('DB_PASSWORD', 'change-me'),
        database: config.get<string>('DB_DATABASE', 'deploy_manager'),
        ssl: config.get<string>('DB_SSL', 'false') === 'true' ? { rejectUnauthorized: false } : false,
        entities: [RepositoryEntity, DeploymentEntity],
        synchronize: true
      }),
    }),
    RepositoriesModule,
    DeploymentsModule,
    WebhooksModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
