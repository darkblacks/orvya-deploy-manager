#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR='/home/ubuntu/deploy/orvya-deploy-manager'
PM2_NAME='orvya-deploy-manager'
HEALTH_URL='http://127.0.0.1:8090/api/health'
TARGET_SHA="${1:?Informe o SHA completo do commit}"
LOCK_FILE='/tmp/orvya-self-deploy.lock'

exec 9>"$LOCK_FILE"
flock -n 9 || { echo 'ERRO: Outro deploy do Orvya esta em andamento'; exit 1; }
cd "$APP_DIR"

case "$TARGET_SHA" in *[!a-fA-F0-9]*|'') echo 'SHA invalido'; exit 1;; esac
[ "${#TARGET_SHA}" -eq 40 ] || { echo 'Exige SHA completo (40 caracteres)'; exit 1; }

git diff --quiet && git diff --cached --quiet || { echo 'ERRO: Mudancas locais rastreadas. Deploy cancelado para nao sobrescrever.'; exit 1; }
[ -z "$(git ls-files --others --exclude-standard | head -1)" ] || { echo 'ERRO: Arquivos nao rastreados. Deploy cancelado.'; exit 1; }

OLD_SHA="$(git rev-parse HEAD)"
STAGE='starting'
RESTORED=0
rollback() {
  local code=$?
  trap - ERR
  echo "FALHA: etapa=$STAGE, commit_alvo=$TARGET_SHA, anterior=$OLD_SHA (exit=$code)"
  if [ "$STAGE" = 'starting' ] || [ "$STAGE" = 'fetch' ]; then exit "$code"; fi
  echo 'Executando rollback do codigo e do processo...'
  if git reset --hard "$OLD_SHA" && npm run build && pm2 restart "$PM2_NAME" --update-env; then
    for i in $(seq 1 20); do
      if curl -fsS --max-time 4 "$HEALTH_URL" >/dev/null; then RESTORED=1; break; fi
      sleep 2
    done
  fi
  if [ "$RESTORED" -eq 1 ]; then
    echo "ROLLBACK_OK: versao anterior $OLD_SHA voltou saudavel"
  else
    echo 'ROLLBACK_FALHOU: verificar PM2 e logs imediatamente' >&2
  fi
  exit "$code"
}
trap rollback ERR

STAGE='fetch'
git fetch --no-tags origin main
REMOTE_SHA="$(git rev-parse refs/remotes/origin/main)"
[ "$TARGET_SHA" = "$REMOTE_SHA" ] || { echo "ERRO: main alterada: $REMOTE_SHA (esperado $TARGET_SHA)"; exit 1; }
[ "$OLD_SHA" != "$TARGET_SHA" ] || { echo "SEM_MUDANCA: $OLD_SHA ja esta em producao"; exit 0; }

# Importante: a etapa de CI no GitHub validou dependencias e build.
# Se houver mudanca no lockfile, instala dependencias antes do build.
STAGE='checkout'
git reset --hard "$TARGET_SHA"
if ! git diff --quiet "$OLD_SHA" "$TARGET_SHA" -- package.json package-lock.json; then
  STAGE='install'
  npm ci --no-audit --no-fund
fi
STAGE='build'
npm run build
STAGE='restart'
pm2 restart "$PM2_NAME" --update-env
STAGE='health'
HEALTHY=0
for i in $(seq 1 25); do
  if curl -fsS --max-time 4 "$HEALTH_URL" >/dev/null; then HEALTHY=1; break; fi
  sleep 2
done
[ "$HEALTHY" -eq 1 ] || { echo 'ERRO: healthcheck falhou'; false; }
STAGE='done'
trap - ERR
echo "DEPLOY_OK: commit=$TARGET_SHA anterior=$OLD_SHA"
