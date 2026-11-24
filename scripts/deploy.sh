#!/usr/bin/env bash
# Yangilanishni serverga yuklash: ./scripts/deploy.sh
# Ma'lumotlar (data/, data-demo/) serverda qoladi, tegilmaydi.
set -euo pipefail
HOST="${DEPLOY_HOST:-root@89.167.12.157}"
KEY="${DEPLOY_KEY:-$HOME/.ssh/nca_hetzner}"
DIR="${DEPLOY_DIR:-/opt/ombor}"
cd "$(dirname "$0")/.."
rsync -az --delete -e "ssh -i $KEY" \
  --exclude node_modules --exclude data --exclude data-demo --exclude dist --exclude tools --exclude .git --exclude '*.tsbuildinfo' \
  ./ "$HOST:$DIR/"
ssh -i "$KEY" "$HOST" "cd $DIR && npm ci --no-audit --no-fund --silent && npm run build --silent && pm2 restart ombor ombor-demo --update-env && pm2 save"
echo "Tayyor: https://ombor.89-167-12-157.sslip.io"
