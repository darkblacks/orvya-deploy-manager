import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DeploymentEntity } from '../deployments/deployment.entity';

@Entity('repositories')
export class RepositoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column()
  githubUrl: string;

  @Column({ default: 'main' })
  branch: string;

  @Column()
  localPath: string;

  @Column()
  pm2Name: string;

  @Column()
  healthUrl: string;

  @Column({ default: 'npm ci' })
  installCommand: string;

  @Column({ default: 'npm run build' })
  buildCommand: string;

  @Column({ default: true })
  enabled: boolean;

  @Column({ nullable: true })
  currentCommit?: string;

  @OneToMany(() => DeploymentEntity, (deployment) => deployment.repository)
  deployments: DeploymentEntity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
