import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeploymentsService } from '../deployments/deployments.service';
import { createHmac, timingSafeEqual } from 'crypto';

@Injectable()
export class WebhooksService {
  constructor(
    private readonly config: ConfigService,
    private readonly deployments: DeploymentsService,
  ) {}

  verifySignature(rawBody: Buffer | undefined, signature?: string) {
    const secret = this.config.get<string>('GITHUB_WEBHOOK_SECRET');
    if (!secret) {
      throw new UnauthorizedException('GITHUB_WEBHOOK_SECRET não configurado');
    }
    if (!rawBody || !signature?.startsWith('sha256=')) {
      throw new UnauthorizedException('Assinatura ausente');
    }

    const expected =
      'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');

    const a = Buffer.from(expected);
    const b = Buffer.from(signature);

    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Assinatura inválida');
    }
  }

  async handleGithubPush(payload: any) {
    if (!payload?.repository?.name || !/^[0-9a-f]{40}$/.test(String(payload?.after || ''))) {
      throw new BadRequestException('Payload GitHub inválido');
    }

    if (payload.deleted) return { accepted: false, reason: 'Branch removida' };
    const branch = String(payload.ref || '').replace('refs/heads/', '');
    if (branch !== 'main') {
      return {
        accepted: false,
        reason: `Branch ${branch} ignorada`,
      };
    }

    const commit = payload.head_commit || {};
    const repositoryName = payload.repository.name;

    const deployment = await this.deployments.queueByRepositoryName(
      repositoryName,
      payload.after,
      commit.message,
      commit.author?.name || payload.pusher?.name,
    );

    return {
      accepted: true,
      deploymentId: deployment.id,
      repository: repositoryName,
      commit: payload.after,
    };
  }
}
