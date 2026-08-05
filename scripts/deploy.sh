#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo ""
echo "Pixelium — Docker deploy"
echo ""

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed. See https://docs.docker.com/get-docker/"
  exit 1
fi

if [[ ! -f .env ]]; then
  if [[ -f .env.production.example ]]; then
    cp .env.production.example .env
    echo "Created .env — edit passwords + GROQ_API_KEY, then re-run."
    exit 0
  fi
  echo "Missing .env"
  exit 1
fi

echo "Building and starting containers..."
docker compose up -d --build

echo ""
echo "Waiting for broker..."
for i in {1..60}; do
  if curl -sf http://localhost/broker/health >/dev/null 2>&1; then
    echo ""
    echo "Deploy complete!"
    echo "  Store: http://localhost"
    echo "  Login: demo@pixelium.com / demo123"
    exit 0
  fi
  sleep 3
done

echo "Started — check: docker compose logs -f broker"
exit 0
