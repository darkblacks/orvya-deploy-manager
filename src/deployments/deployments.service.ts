import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeploymentEntity } from './deployment.entity';
import { DeploymentStatus } from './deployment-status.enum';
import { RepositoriesService } from '../repositories/repositories.service';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

@Injectable()
export class DeploymentsService {
  private readonly logger = new Logger(DeploymentsService.name);
  private readonly activeRepos = new Set<string>();

  constructor(
    @InjectRepository(DeploymentEntity)
    private readonly deployments: Repository<DeploymentEntity>,
    private readonly repositories: RepositoriesService,
  ) {}

  findAll() {
    return this.deployments.find({
      relations: { repository: true },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async findByRepository(repositoryId: string) {
    return this.deployments.find({
      where: { repository: { id: repositoryId } },
      relations: { repository: true },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async findOne(id: string) {
    const item = await this.deployments.findOne({
      where: { id },
      relations: { repository: true },
    });
    if (!item) throw new NotFoundException('Deployment não encontrado');
    return item;
  }

  async queueByRepositoryName(
    repositoryName: string,
    commitSha: string,
    commitMessage?: string,
    author?: string,
  ) {
    const repository = await this.repositories.findByName(repositoryName);
    if (this.activeRepos.has(repository.id)) throw new ConflictException('Deploy em andamento para este repositório');
    const deployment = this.deployments.create({
      repository,
      commitSha,
      commitMessage,
      author,
      status: DeploymentStatus.QUEUED,
    });
    const saved = await this.deployments.save(deployment);

    // Não bloqueia o webhook enquanto o build acontece.
    this.activeRepos.add(repository.id);
    setImmediate(() => {
      this.runDeployment(saved.id, true).catch((error) => {
        this.logger.error(error);
      });
    });

    return saved;
  }

  async runDeployment(id: string, queued = false) {
    const deployment = await this.findOne(id);
    const repo = deployment.repository;
    if (!queued) {
      if (this.activeRepos.has(repo.id)) throw new ConflictException('Deploy em andamento');
      this.activeRepos.add(repo.id);
    }
    if (queued && !this.activeRepos.has(repo.id)) this.activeRepos.add(repo.id);

    if (!repo.enabled) {
      deployment.status = DeploymentStatus.DEPLOY_FAILED;
      deployment.error = 'Repositório desabilitado';
      deployment.finishedAt = new Date();
      this.activeRepos.delete(repo.id);
      return this.deployments.save(deployment);
    }

    const workRoot =
      process.env.DEPLOY_WORK_ROOT ||
      path.join(os.tmpdir(), 'orvya-deploy-work');
    fs.mkdirSync(workRoot, { recursive: true });

    const safeName = repo.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const workDir = path.join(
      workRoot,
      `${safeName}-${deployment.commitSha.slice(0, 12)}`,
    );

    let originalSha = '';
    let didModifyProduction = false;
    let deployLog = '';
    try {
      // O clone de produção precisa ser um repositório Git independente.
      originalSha = (await this.exec('git', ['rev-parse', 'HEAD'], repo.localPath)).trim();
      const remote = (await this.exec('git', ['remote', 'get-url', 'origin'], repo.localPath)).trim();
      if (remote !== repo.githubUrl) throw new Error('Origin do projeto diverge do GitHub cadastrado');
      deployment.status = DeploymentStatus.BUILDING;
      await this.deployments.save(deployment);

      fs.rmSync(workDir, { recursive: true, force: true });

      let log = '';
      log += await this.exec(
        'git',
        ['clone', '--no-checkout', repo.githubUrl, workDir],
        workRoot,
      );
      log += await this.exec('git', ['checkout', deployment.commitSha], workDir);

      log += await this.execShell(repo.installCommand, workDir);
      log += await this.execShell(repo.buildCommand, workDir);

      deployment.buildLog = this.limitLog(log);
      deployment.status = DeploymentStatus.DEPLOYING;
      await this.deployments.save(deployment);

      // Atualiza a pasta de produção apenas depois do build passar.
      // Só altera a produção depois de validar o build temporário.
      deployLog += await this.exec('git', ['fetch', 'origin'], repo.localPath);
      didModifyProduction = true;
      deployLog += await this.exec('git', ['reset', '--hard', deployment.commitSha], repo.localPath);
      deployLog += await this.execShell(repo.installCommand, repo.localPath);
      deployLog += await this.execShell(repo.buildCommand, repo.localPath);

      deployLog += await this.exec(
        'pm2',
        ['restart', repo.pm2Name, '--update-env'],
        repo.localPath,
      );

      deployment.status = DeploymentStatus.HEALTH_CHECK;
      deployment.deployLog = this.limitLog(deployLog);
      await this.deployments.save(deployment);

      await this.waitForHealth(repo.healthUrl);

      await this.deployments.update(
        { repository: { id: repo.id }, isCurrent: true },
        { isCurrent: false },
      );

      deployment.status = DeploymentStatus.SUCCESS;
      deployment.isCurrent = true;
      deployment.finishedAt = new Date();
      deployment.error = undefined;
      await this.deployments.save(deployment);

      await this.repositories.setCurrentCommit(repo.id, deployment.commitSha);
      return deployment;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      deployment.status =
        deployment.status === DeploymentStatus.BUILDING
          ? DeploymentStatus.BUILD_FAILED
          : DeploymentStatus.DEPLOY_FAILED;
      let errorReport = message;
      if (didModifyProduction && originalSha) {
        try {
          deployment.status = DeploymentStatus.ROLLBACK;
          await this.deployments.save(deployment);
          deployLog += '\n--- ROLLBACK INICIADO ---\n';
          deployLog += await this.exec('git', ['reset', '--hard', originalSha], repo.localPath);
          deployLog += await this.execShell(repo.installCommand, repo.localPath);
          deployLog += await this.execShell(repo.buildCommand, repo.localPath);
          deployLog += await this.exec('pm2', ['restart', repo.pm2Name, '--update-env'], repo.localPath);
          await this.waitForHealth(repo.healthUrl);
          errorReport += '\nRollback executado e healthcheck aprovado. SHA: ' + originalSha;
        } catch (rollbackError) {
          errorReport += '\nALERTA: ROLLBACK FALHOU: ' + String(rollbackError);
          this.logger.error(errorReport);
        }
      }
      deployment.status =
        didModifyProduction ? DeploymentStatus.DEPLOY_FAILED : DeploymentStatus.BUILD_FAILED;
      deployment.deployLog = this.limitLog(deployLog);
      deployment.error = this.limitLog(errorReport);
      deployment.finishedAt = new Date();
      await this.deployments.save(deployment);
      return deployment;
    } finally {
      this.activeRepos.delete(repo.id);
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  }

  private async waitForHealth(url: string) {
    let lastError = 'Health check falhou';
    for (let i = 0; i < 10; i++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);

        if (response.ok) return;

        lastError = `Health HTTP ${response.status}`;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error(`Health check falhou: ${lastError}`);
  }

  private exec(command: string, args: string[], cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd,
        env: process.env,
      });

      let output = '';

      child.stdout.on('data', (data) => {
        output += data.toString();
      });
      child.stderr.on('data', (data) => {
        output += data.toString();
      });

      child.on('error', reject);

      child.on('close', (code) => {
        if (code === 0) return resolve(output);
        reject(
          new Error(
            `${command} ${args.join(' ')} falhou com código ${code}\n${output}`,
          ),
        );
      });
    });
  }

  private execShell(command: string, cwd: string): Promise<string> {
    return this.exec('/bin/bash', ['-lc', command], cwd);
  }

  private limitLog(value: string, max = 100_000) {
    if (value.length <= max) return value;
    return value.slice(value.length - max);
  }
}
