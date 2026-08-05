# Permanent internet hosting — VPS setup (Ubuntu 22.04+)
#
# Run ON THE VPS after SSH login:
#   curl -fsSL https://raw.githubusercontent.com/...  # or copy this file
#   bash vps-setup.sh
#
# Before running, set these (or export them):
#   DOMAIN=shop.example.com          # optional, for HTTPS with Caddy
#   GROQ_API_KEY=gsk_...

set -euo pipefail

DOMAIN="${DOMAIN:-}"
GROQ_API_KEY="${GROQ_API_KEY:-}"

echo "=== Pixelium VPS setup ==="

if ! command -v docker >/dev/null 2>&1; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
fi

if ! command -v docker compose >/dev/null 2>&1; then
  apt-get update && apt-get install -y docker-compose-plugin
fi

APP_DIR="${APP_DIR:-/opt/pixelium}"
mkdir -p "$APP_DIR"
cd "$APP_DIR"

if [[ ! -f docker-compose.yml ]]; then
  echo "Copy the pixelium-consent-commerce folder to $APP_DIR first."
  echo "  scp -r pixelium-consent-commerce user@YOUR_VPS_IP:/opt/pixelium"
  exit 1
fi

if [[ ! -f .env ]]; then
  cp .env.production.example .env
  JWT=$(openssl rand -hex 32)
  MYSQL_ROOT=$(openssl rand -hex 16)
  MYSQL_APP=$(openssl rand -hex 16)
  sed -i "s/change-me-root-password/$MYSQL_ROOT/" .env
  sed -i "s/change-me-app-password/$MYSQL_APP/" .env
  sed -i "s/change-me-to-a-long-random-secret/$JWT/" .env
  if [[ -n "$GROQ_API_KEY" ]]; then
    sed -i "s/your_groq_api_key_here/$GROQ_API_KEY/" .env
  fi
  if [[ -n "$DOMAIN" ]]; then
    sed -i "s|http://localhost|https://$DOMAIN|g" .env
    sed -i "s|http://localhost/broker|https://$DOMAIN/broker|g" .env
  fi
  echo "Created .env — edit GROQ_API_KEY if needed: nano .env"
fi

echo "Building and starting..."
docker compose up -d --build

echo "Waiting for health..."
for i in $(seq 1 60); do
  if curl -sf http://127.0.0.1/broker/health >/dev/null 2>&1; then
    echo ""
    echo "=== Deploy complete ==="
    if [[ -n "$DOMAIN" ]]; then
      echo "Store: https://$DOMAIN"
    else
      echo "Store: http://$(curl -s ifconfig.me 2>/dev/null || echo YOUR_VPS_IP)"
    fi
    echo "Login: demo@pixelium.com / demo123"
    exit 0
  fi
  sleep 5
done

echo "Services starting — check: docker compose logs -f broker"
