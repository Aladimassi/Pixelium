#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FINAL="${1:-pixelium-deploy.tar.gz}"
STAGING="${RUNNER_TEMP:-/tmp}/pixelium-deploy.$$.tar.gz"

rm -f "$STAGING" "$FINAL"

tar -czf "$STAGING" \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=data \
  --exclude=.cursor \
  --exclude=.pytest_cache \
  --exclude=__pycache__ \
  --exclude='*.tar.gz' \
  --exclude=.env \
  --exclude='*.tsbuildinfo' \
  --exclude=terminals \
  --exclude='*.log' \
  .

mv "$STAGING" "$FINAL"
ls -lh "$FINAL"
