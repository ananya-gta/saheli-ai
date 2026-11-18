#!/usr/bin/env bash
# Update the live server to the latest code on GitHub:   ./scripts/deploy.sh
# Data (database, websites, photos, HTTPS certificates) lives in Docker volumes and is never touched.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env ] || { echo "ERROR: .env missing. Run: cp .env.example .env  and fill it in."; exit 1; }
grep -q "REPLACE_ME" .env && { echo "ERROR: .env still has REPLACE_ME values."; exit 1; }

echo "==> Pulling latest code"
git pull --ff-only

echo "==> Building and starting containers"
docker compose up -d --build

echo "==> Waiting for the API to become healthy"
for i in $(seq 1 40); do
  status=$(docker inspect --format '{{.State.Health.Status}}' "$(docker compose ps -q api)" 2>/dev/null || echo starting)
  [ "$status" = "healthy" ] && break
  sleep 3
done
docker compose ps
[ "$status" = "healthy" ] || { echo "API is not healthy — see: docker compose logs --tail 100 api"; exit 1; }

DOMAIN=$(grep -E '^DOMAIN=' .env | cut -d= -f2- | tr -d '"' || true)
if [ -n "${DOMAIN:-}" ]; then
  echo "==> Public check: https://$DOMAIN/api/health"
  curl -fsS --max-time 15 "https://$DOMAIN/api/health" && echo
fi
docker image prune -f >/dev/null
echo "==> Deployed $(git rev-parse --short HEAD)"
