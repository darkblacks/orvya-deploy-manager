import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RepositoryEntity } from '../repositories/repository.entity';
import { DeploymentStatus } from './deployment-status.enum';

@Entity('deployments')
export class DeploymentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => RepositoryEntity, (repository) => repository.deployments, {
    onDelete: 'CASCADE',
  })
  repository: RepositoryEntity;

  @Column()
  commitSha: string;

  @Column({ nullable: true })
  commitMessage?: string;

  @Column({ nullable: true })
  author?: string;

  @Column({
    type: 'enum',
    enum: DeploymentStatus,
    default: DeploymentStatus.QUEUED,
  })
  status: DeploymentStatus;

  @Column({ type: 'text', nullable: true })
  buildLog?: string;

  @Column({ type: 'text', nullable: true })
  deployLog?: string;

  @Column({ type: 'text', nullable: true })
  error?: string;

  @Column({ default: false })
  isCurrent: boolean;

  @Column({ nullable: true })
  finishedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
