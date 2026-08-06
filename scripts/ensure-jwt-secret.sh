#!/usr/bin/env bash
# Ensure JWT_SECRET in ~/pixelium/.env is production-safe (>=32 chars, not a placeholder).
# Usage: bash ensure-jwt-secret.sh [--force]
set -euo pipefail

ENV_FILE="${ENV_FILE:-$HOME/pixelium/.env}"
FORCE="${1:-}"

PLACEHOLDERS=(
  'pixelium-dev-jwt-secret-change-in-production'
  'change-me-to-a-long-random-secret'
  'change-to-long-random-string'
  'your-long-random-jwt-secret'
)

is_placeholder() {
  local val="$1"
  for p in "${PLACEHOLDERS[@]}"; do
    [[ "$val" == "$p" ]] && return 0
  done
  return 1
}

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found"
  exit 1
fi

current="$(grep -E '^JWT_SECRET=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r\n"' || true)"

needs_rotate=false
if [[ "$FORCE" == "--force" ]]; then
  needs_rotate=true
elif [[ -z "$current" ]]; then
  needs_rotate=true
elif [[ "${#current}" -lt 32 ]]; then
  needs_rotate=true
elif is_placeholder "$current"; then
  needs_rotate=true
fi

if [[ "$needs_rotate" != true ]]; then
  echo "JWT_SECRET OK (${#current} chars, not a placeholder)"
  exit 0
fi

new_secret="$(openssl rand -base64 48 | tr -d '\n\r')"
tmp="$(mktemp)"
if grep -q '^JWT_SECRET=' "$ENV_FILE"; then
  sed "s|^JWT_SECRET=.*|JWT_SECRET=${new_secret}|" "$ENV_FILE" > "$tmp"
else
  cp "$ENV_FILE" "$tmp"
  printf '\nJWT_SECRET=%s\n' "$new_secret" >> "$tmp"
fi
mv "$tmp" "$ENV_FILE"
chmod 600 "$ENV_FILE"
echo "JWT_SECRET rotated (${#new_secret} chars). Existing sessions will need to re-login."
