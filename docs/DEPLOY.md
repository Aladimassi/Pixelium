# Deploy Pixelium with Docker Compose

This guide covers the recommended production deployment: **Docker Compose** on a VPS (DigitalOcean, Hetzner, AWS EC2, etc.) or locally for a production-like test.

## Architecture (production)

```
Internet :80
    │
    ▼
┌─────────┐     ┌───────────┐     ┌────────┐
│  nginx  │────►│ dashboard │     │  mysql │
│         │     │   :3000   │     │  :3306 │
│ /broker │────►│  broker   │◄───►│        │
└─────────┘     │   :4000   │     └────────┘
                └─────┬─────┘
                      │ HTTP
              ┌───────┴────────┐
              ▼                ▼
        product-agent    payment-agent
           :4001              :4002
```

The browser loads the store from nginx (`/`) and calls the broker API at **`BROKER_URL`** (default `http://localhost/broker`).

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| **Docker Desktop** (Windows/Mac) or **Docker Engine + Compose** (Linux) | [docker.com](https://www.docker.com/products/docker-desktop/) |
| **Groq API key** | [console.groq.com](https://console.groq.com) — AI shopping + voice |
| **2 GB+ RAM** | MySQL + Node + Python agents |
| **Open port 80** | Or change `PUBLIC_HTTP_PORT` in `.env` |

## Quick deploy (local or VPS)

### 1. Configure environment

```powershell
cd pixelium-consent-commerce
copy .env.production.example .env
```

Edit `.env` and set at minimum:

```env
MYSQL_ROOT_PASSWORD=your-strong-root-password
MYSQL_PASSWORD=your-strong-app-password
JWT_SECRET=your-long-random-jwt-secret
GROQ_API_KEY=gsk_...
```

For a **public VPS** with domain `shop.example.com`:

```env
PUBLIC_URL=https://shop.example.com
BROKER_URL=https://shop.example.com/broker
```

> `BROKER_URL` must be reachable **from the user's browser** (not an internal Docker hostname).

### 2. Build and start

```powershell
docker compose up -d --build
```

First start takes **5–15 minutes** (downloads images, builds Node/Python, seeds MySQL catalog).

### 3. Open the store

| URL | Purpose |
|-----|---------|
| http://localhost | Store UI (via nginx) |
| http://localhost/broker/health | Broker health check |

**Demo login** (created automatically on first start):

- Email: `demo@pixelium.com`
- Password: `demo123`

### 4. Useful commands

```powershell
docker compose ps                 # service status
docker compose logs -f broker     # broker logs
docker compose logs -f dashboard  # UI logs
docker compose down               # stop
docker compose down -v            # stop + delete database volume
```

## One-command script (Windows)

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1
```

## HTTPS (recommended for production)

1. Point DNS `A` record → your VPS IP.
2. Put **Caddy** or **Traefik** in front of nginx, or replace nginx with Caddy for automatic Let's Encrypt.
3. Set in `.env`:

```env
PUBLIC_URL=https://shop.example.com
BROKER_URL=https://shop.example.com/broker
```

Example Caddyfile (instead of exposing nginx on 80):

```
shop.example.com {
  reverse_proxy /broker/* localhost:4000
  reverse_proxy * localhost:3000
}
```

Then run dashboard + broker with `docker compose up dashboard broker ...` without the nginx service, or map nginx only internally.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MYSQL_ROOT_PASSWORD` | yes | MySQL root password |
| `MYSQL_PASSWORD` | yes | App user password |
| `JWT_SECRET` | yes | Session signing secret (long random string) |
| `GROQ_API_KEY` | yes* | Groq LLM + Whisper (*AI features disabled without it) |
| `BROKER_URL` | yes | Public broker URL for the browser |
| `PUBLIC_HTTP_PORT` | no | Host port for nginx (default `80`) |
| `GROQ_MODEL` | no | Default `llama-3.3-70b-versatile` |
| `GROQ_WHISPER_MODEL` | no | Default `whisper-large-v3-turbo` |

## Persistent data

Docker volumes:

- `mysql_data` — products + users
- `broker_data` — audit log (`audit.json`)

Backup:

```powershell
docker compose exec mysql mysqldump -u root -p pixelium_consent > backup.sql
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ERR_CONNECTION_REFUSED` | Run `docker compose ps` — all services should be `healthy` |
| AI / voice not working | Set `GROQ_API_KEY` in `.env`, restart broker |
| Login fails | Wait for MySQL healthcheck; check `docker compose logs broker` |
| CORS / API errors in browser | `BROKER_URL` must match how users reach the broker (same host as store) |
| Port 80 in use | Set `PUBLIC_HTTP_PORT=8080` and open `http://localhost:8080` |

## Cloud alternatives

This stack runs **5 services + MySQL** — best suited to a **VPS with Docker**.

| Platform | Approach |
|----------|----------|
| **DigitalOcean / Hetzner / EC2** | Docker Compose (this guide) |
| **Railway / Render** | Deploy each service separately; use managed MySQL |
| **Fly.io** | `fly launch` per app + Fly Postgres/MySQL |

For internship demo / submission, Docker Compose on a small VPS ($5–6/mo) is the simplest path.

## Security checklist (production)

- [ ] Change `JWT_SECRET`, MySQL passwords, demo user password
- [ ] Use HTTPS
- [ ] Restrict MySQL port (not exposed publicly — default in this compose file)
- [ ] Rotate `GROQ_API_KEY` if leaked
- [ ] Do not commit `.env` to git
