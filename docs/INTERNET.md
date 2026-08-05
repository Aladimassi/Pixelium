# Put on the internet

Two ways to share Pixelium publicly.

---

## Option A — Quick public link (free, ~5 minutes)

Your PC stays on. Good for demos and testing.

### 1. Start the app locally

```powershell
cd pixelium-consent-commerce
npm run dev
```

Wait until you see `Dashboard on http://localhost:3000` and `Consent Broker on http://localhost:4000`.

### 2. Expose to the internet

**Easiest (Node only, no install):**

```powershell
npm run expose:lt
```

**Or with Cloudflare (faster, no password page):**

```powershell
winget install Cloudflare.cloudflared
npm run expose
```

You get a public URL like:

```
https://something-random.trycloudflare.com
```

Share that link — anyone on the internet can open your store.

**Login:** `demo@pixelium.com` / `demo123`

> URLs change each time you restart the tunnel. Your PC must stay on.

---

## Option B — Permanent hosting on a VPS (recommended)

Your app runs 24/7 on a cloud server (~$5/month).

### 1. Rent a VPS

| Provider | Plan | Price |
|----------|------|-------|
| [Hetzner](https://www.hetzner.com/cloud) | CX22 | ~€4/mo |
| [DigitalOcean](https://www.digitalocean.com) | Basic 1GB | ~$6/mo |
| [Contabo](https://contabo.com) | VPS S | ~€5/mo |

Choose **Ubuntu 22.04**, any region close to you.

### 2. Open firewall ports

On the VPS provider panel, allow:

- **TCP 80** (HTTP)
- **TCP 443** (HTTPS, optional)

### 3. Copy project to the VPS

From your PC (replace `YOUR_VPS_IP` and user):

```powershell
scp -r "c:\Users\Aloulouu\Desktop\Nouveau dossier\pixelium-consent-commerce" root@YOUR_VPS_IP:/opt/pixelium
```

### 4. SSH into the VPS and deploy

```bash
ssh root@YOUR_VPS_IP
cd /opt/pixelium/pixelium-consent-commerce   # adjust path if needed
```

Edit secrets:

```bash
cp .env.production.example .env
nano .env
```

Set:

- `MYSQL_ROOT_PASSWORD`
- `MYSQL_PASSWORD`
- `JWT_SECRET` (long random string)
- `GROQ_API_KEY`
- `BROKER_URL=http://YOUR_VPS_IP/broker` (or `https://yourdomain.com/broker`)

Deploy:

```bash
docker compose up -d --build
```

Or use the helper:

```bash
GROQ_API_KEY=gsk_your_key bash scripts/vps-setup.sh
```

### 5. Open in browser

```
http://YOUR_VPS_IP
```

### 6. Add a domain + HTTPS (optional)

1. Buy a domain (Namecheap, Cloudflare, etc.)
2. Add DNS **A record** → your VPS IP
3. Update `.env`:

```env
PUBLIC_URL=https://shop.yourdomain.com
BROKER_URL=https://shop.yourdomain.com/broker
```

4. Install Caddy for automatic HTTPS:

```bash
apt install -y caddy
```

Caddyfile:

```
shop.yourdomain.com {
  reverse_proxy /broker/* localhost:4000
  reverse_proxy * localhost:3000
}
```

Then expose dashboard on 3000 and broker on 4000 directly (disable nginx in compose or map ports).

---

## Which option?

| | Quick tunnel | VPS |
|---|-------------|-----|
| Cost | Free | ~$5/month |
| Setup time | 5 min | 30 min |
| PC must stay on | Yes | No |
| Custom domain | No | Yes |
| 24/7 uptime | No | Yes |

**Demo today** → Option A (`npm run expose`)  
**Real deployment** → Option B (VPS + Docker)

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `cloudflared not found` | `winget install Cloudflare.cloudflared` |
| AI not working on public URL | Set `BROKER_URL` to the **broker tunnel URL**, restart dashboard |
| VPS: connection refused | Open port 80 in firewall; `docker compose ps` |
| VPS: AI broken | Set `GROQ_API_KEY` in `.env`, `docker compose restart broker` |

See also [DEPLOY.md](./DEPLOY.md) for full Docker reference.
