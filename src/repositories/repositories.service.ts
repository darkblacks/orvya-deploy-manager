import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RepositoryEntity } from './repository.entity';
import { CreateRepositoryDto } from './dto/create-repository.dto';

@Injectable()
export class RepositoriesService {
  constructor(
    @InjectRepository(RepositoryEntity)
    private readonly repo: Repository<RepositoryEntity>,
  ) {}

  findAll() {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string) {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Repositório não encontrado');
    return item;
  }

  async findByName(name: string) {
    const item = await this.repo.findOne({ where: { name } });
    if (!item) throw new NotFoundException('Repositório não encontrado');
    return item;
  }

  create(dto: CreateRepositoryDto) {
    const item = this.repo.create(dto);
    return this.repo.save(item);
  }

  async setCurrentCommit(id: string, sha: string) {
    await this.repo.update(id, { currentCommit: sha });
    return this.findOne(id);
  }
}
