import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RepositoriesService } from './repositories.service';
import { CreateRepositoryDto } from './dto/create-repository.dto';

@Controller('repositories')
export class RepositoriesController {
  constructor(private readonly service: RepositoriesService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateRepositoryDto) {
    return this.service.create(dto);
  }
}
