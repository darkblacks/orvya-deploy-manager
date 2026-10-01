import {
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { WebhooksService } from './webhooks.service';

type RawRequest = Request & { rawBody?: Buffer };

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly service: WebhooksService) {}

  @Post('github')
  @HttpCode(202)
  github(
    @Req() req: RawRequest,
    @Headers('x-hub-signature-256') signature?: string,
  ) {
    this.service.verifySignature(req.rawBody, signature);
    return this.service.handleGithubPush(req.body);
  }
}
