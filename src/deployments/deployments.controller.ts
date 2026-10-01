import { Controller, Get, Param, Post } from '@nestjs/common';
import { DeploymentsService } from './deployments.service';

@Controller('deployments')
export class DeploymentsController {
  constructor(private readonly service: DeploymentsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get('repository/:repositoryId')
  findByRepository(@Param('repositoryId') repositoryId: string) {
    return this.service.findByRepository(repositoryId);
  }

  @Post(':id/retry')
  retry(@Param('id') id: string) {
    return this.service.runDeployment(id);
  }
}
