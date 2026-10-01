import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeploymentEntity } from './deployment.entity';
import { DeploymentsService } from './deployments.service';
import { DeploymentsController } from './deployments.controller';
import { RepositoriesModule } from '../repositories/repositories.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DeploymentEntity]),
    RepositoriesModule,
  ],
  providers: [DeploymentsService],
  controllers: [DeploymentsController],
  exports: [DeploymentsService],
})
export class DeploymentsModule {}
