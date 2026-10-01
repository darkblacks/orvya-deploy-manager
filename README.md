# Orvya Deploy Manager

MVP de gestão de builds/deploys para projetos Node/NestJS executados via PM2.

## Porta

A API usa `PORT=8090` por padrão.

Health:
`GET /api/health`

## Banco

PostgreSQL em Docker, exposto somente em localhost.

Porta padrão do banco: `5435`.

## Subir banco

```bash
cp .env.example .env
# edite senhas/segredo
docker compose up -d db
```

## Instalar e buildar

```bash
npm ci
npm run build
```

## PM2

No servidor, ajuste o `cwd` de `ecosystem.config.js` se necessário e execute:

```bash
pm2 start ecosystem.config.js --env production
pm2 save
```

## Cadastrar repositórios

### Actrya

```bash
curl -X POST http://127.0.0.1:8090/api/repositories \
  -H 'Content-Type: application/json' \
  -d '{
    "name":"AWS_ORVYA_actrya-backend",
    "githubUrl":"https://github.com/darkblacks/AWS_ORVYA_actrya-backend.git",
    "branch":"main",
    "localPath":"/home/ubuntu/deploy/actrya-backend",
    "pm2Name":"actrya-backend",
    "healthUrl":"http://127.0.0.1:3001/api/health"
  }'
```

### Transmassa

```bash
curl -X POST http://127.0.0.1:8090/api/repositories \
  -H 'Content-Type: application/json' \
  -d '{
    "name":"AWS_ORVYA_transmassa-nest-backend",
    "githubUrl":"https://github.com/darkblacks/AWS_ORVYA_transmassa-nest-backend.git",
    "branch":"main",
    "localPath":"/home/ubuntu/deploy/transmassa-nest-backend",
    "pm2Name":"transmassa-nest-api",
    "healthUrl":"http://127.0.0.1:8081/health"
  }'
```

## Webhook GitHub

Endpoint:

`POST /api/webhooks/github`

Configure no GitHub:
- Payload URL: URL pública + `/api/webhooks/github`
- Content type: `application/json`
- Secret: mesmo valor de `GITHUB_WEBHOOK_SECRET`
- Evento: `Just the push event`

## Fluxo

1. GitHub envia push.
2. API cria deployment como `QUEUED`.
3. Clona o commit em diretório temporário.
4. Roda `npm ci`.
5. Roda `npm run build`.
6. Se falhar: `BUILD_FAILED`, produção permanece como estava.
7. Se passar: atualiza o clone de produção.
8. Reinstala dependências e builda.
9. Reinicia PM2.
10. Faz health check.
11. Se passar: `SUCCESS` e marca o commit como atual.

## Endpoints

- `GET /api/health`
- `GET /api/repositories`
- `POST /api/repositories`
- `GET /api/repositories/:id`
- `GET /api/deployments`
- `GET /api/deployments/:id`
- `GET /api/deployments/repository/:repositoryId`
- `POST /api/deployments/:id/retry`
- `POST /api/webhooks/github`

## Segurança

O webhook valida `X-Hub-Signature-256`.

Este MVP pressupõe que:
- o serviço roda como o mesmo usuário que controla o PM2;
- os repositórios cadastrados são confiáveis;
- `installCommand` e `buildCommand` são definidos apenas por administrador;
- a API de cadastro de repositórios não deve ser exposta publicamente sem autenticação/reverse proxy.
