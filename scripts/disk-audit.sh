#!/usr/bin/env bash
set -euo pipefail
printf '\n=== ESPACO ===\n'; df -h /
printf '\n=== USO DO DOCKER ===\n'; docker system df
printf '\n=== PASTAS /home/ubuntu (somente tamanhos) ===\n'; du -h --max-depth=1 /home/ubuntu 2>/dev/null | sort -h | tail -25
printf '\nNao remove arquivos, imagens ou volumes.\n'
