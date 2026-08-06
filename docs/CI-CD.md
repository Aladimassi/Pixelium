# CI/CD pipeline

Pixelium uses **GitHub Actions** for continuous integration and deployment to the Azure VM.

## Workflows

| Workflow | File | Trigger | Purpose |
|----------|------|---------|---------|
| **CI** | `.github/workflows/ci.yml` | Push / PR to `main` | Build, guardrail tests, Python tests, Docker image build |
| **Deploy** | `.github/workflows/deploy.yml` | CI success on `main`, or manual | SSH deploy to production VM |

### CI (`ci.yml`)

1. `npm ci` + `npm run build`
2. `npm run test:guardrails` (broker)
3. `pytest` for Python agents
4. `docker compose build` (validates Dockerfiles)

### Deploy (`deploy.yml`)

1. Runs automatically after **CI passes** on `main`
2. Builds deploy tarball (`scripts/create-deploy-archive.sh`)
3. Uploads to Azure VM via SCP
4. Runs `scripts/remote-deploy.sh` (preserves server `.env`, `docker compose up -d --build`)
5. Checks `https://pixelium.duckdns.org/broker/health`

Manual deploy: **Actions → Deploy → Run workflow**

## One-time GitHub setup

### 1. Repository secrets

Open **Settings → Secrets and variables → Actions** and add:

| Secret | Example | Required |
|--------|---------|----------|
| `AZURE_SSH_PRIVATE_KEY` | Contents of your `azure_vm` private key | Yes |
| `AZURE_HOST` | `158.158.122.5` | Yes |
| `AZURE_USER` | `azureuser` | Yes |
| `PRODUCTION_HEALTH_URL` | `https://pixelium.duckdns.org/broker/health` | No (default used) |

To copy your SSH private key (PowerShell):

```powershell
Get-Content "$env:USERPROFILE\.ssh\azure_vm"
```

Paste the full key including `-----BEGIN ... KEY-----` lines into `AZURE_SSH_PRIVATE_KEY`.

### 2. Production environment (optional)

Create **Settings → Environments → production** to require manual approval before deploy.

### 3. Server prerequisites

The VM must already have:

- Docker + Docker Compose
- `~/pixelium/.env` with production values (deploy script backs this up automatically)
- SSH access for `AZURE_USER` with the public key matching `AZURE_SSH_PRIVATE_KEY`

## Branch flow

```
feature branch → PR → CI runs
       ↓ merge to main
CI runs again → Deploy runs → production updated
```

## Local commands (same as CI)

```bash
npm ci
npm run build
npm run test:guardrails -w @pixelium/consent-broker
npm run test:agents
bash scripts/create-deploy-archive.sh
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Deploy SSH fails | Check `AZURE_*` secrets and VM firewall (port 22). Re-paste the full private key (`-----BEGIN ... KEY-----` through `-----END ... KEY-----`) into `AZURE_SSH_PRIVATE_KEY`. If you use a **production** environment, add secrets there too. |
| CI Docker build fails | Ensure `.env` vars in workflow match `docker-compose.yml` required keys |
| Health check timeout | SSH to VM: `docker compose -f ~/pixelium/docker-compose.yml ps` and `logs broker` |
| Deploy skipped | CI must pass on `main` before auto-deploy runs |
| Create deploy archive fails | Archive is written to `$RUNNER_TEMP` first to avoid tar self-inclusion; check Actions log for `tar` errors |
