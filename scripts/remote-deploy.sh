#!/usr/bin/env bash
set -euo pipefail

for f in "$HOME/pixelium/.env" "$HOME/pixelium/pixelium-consent-commerce/.env"; do
  if [[ -f "$f" ]]; then
    cp "$f" /tmp/pixelium.env.bak
    echo "Backed up env from $f"
    break
  fi
done

sudo rm -rf "$HOME/pixelium"
mkdir -p "$HOME/pixelium"
cd "$HOME/pixelium"
tar -xzf ../pixelium-deploy.tar.gz

if [[ -f /tmp/pixelium.env.bak ]]; then
  cp /tmp/pixelium.env.bak .env
fi

if [[ ! -f .env ]]; then
  echo "ERROR: no .env on server"
  exit 1
fi

echo "Starting docker compose build..."
docker compose up -d --build

echo "Waiting for health..."
for i in $(seq 1 90); do
  if curl -sf http://localhost/broker/health >/dev/null 2>&1; then
    echo "HEALTH_OK"
    curl -s http://localhost/broker/health
    docker compose ps
    exit 0
  fi
  sleep 5
done

echo "HEALTH_TIMEOUT"
docker compose ps
docker compose logs --tail 40 broker
exit 1
