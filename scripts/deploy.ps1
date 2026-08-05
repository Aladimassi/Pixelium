# Deploy Pixelium with Docker Compose (Windows)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

Write-Host ""
Write-Host "Pixelium — Docker deploy" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Host "Docker is not installed. Install Docker Desktop:" -ForegroundColor Red
  Write-Host "  https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
  exit 1
}

if (-not (Test-Path ".env")) {
  if (Test-Path ".env.production.example") {
    Copy-Item ".env.production.example" ".env"
    Write-Host "Created .env from .env.production.example" -ForegroundColor Yellow
    Write-Host "Edit .env (MYSQL passwords, JWT_SECRET, GROQ_API_KEY) then re-run." -ForegroundColor Yellow
    exit 0
  }
  Write-Host "Missing .env — copy .env.production.example to .env first." -ForegroundColor Red
  exit 1
}

Write-Host "Building and starting containers (first run may take 10+ min)..." -ForegroundColor White
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host ""
Write-Host "Waiting for services..." -ForegroundColor White
$deadline = (Get-Date).AddMinutes(5)
$ready = $false
while ((Get-Date) -lt $deadline) {
  try {
    Invoke-RestMethod -Uri "http://localhost/broker/health" -TimeoutSec 3 | Out-Null
    $ready = $true
    break
  } catch {
    Start-Sleep -Seconds 3
  }
}

Write-Host ""
if ($ready) {
  Write-Host "Deploy complete!" -ForegroundColor Green
  Write-Host "  Store:  http://localhost" -ForegroundColor White
  Write-Host "  Login:  demo@pixelium.com / demo123" -ForegroundColor White
  Write-Host "  Docs:   docs/DEPLOY.md" -ForegroundColor White
} else {
  Write-Host "Services started but health check timed out." -ForegroundColor Yellow
  Write-Host "Run: docker compose logs -f broker" -ForegroundColor White
}
Write-Host ""
