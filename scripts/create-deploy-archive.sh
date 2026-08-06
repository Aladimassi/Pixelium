#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OUTPUT="${1:-pixelium-deploy.tar.gz}"

tar -czf "$OUTPUT" \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=data \
  --exclude=.cursor \
  --exclude='*.tar.gz' \
  --exclude='.env' \
  .

echo "Created $OUTPUT ($(du -h "$OUTPUT" | awk '{print $1}'))"
