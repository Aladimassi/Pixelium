# Expose Pixelium on the internet via Cloudflare Quick Tunnels (free, no account).
# Requires: app running locally (npm run dev) + cloudflared installed.
#
# Install cloudflared (Windows):
#   winget install Cloudflare.cloudflared
#
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

function Get-CloudflaredExe {
  $cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $default = Join-Path $env:ProgramFiles "Cloudflare\cloudflared\cloudflared.exe"
  if (Test-Path $default) { return $default }
  return $null
}

function Test-Port($port) {
  try {
    if ($port -eq 4000) {
      Invoke-RestMethod -Uri "http://localhost:$port/health" -TimeoutSec 2 | Out-Null
    } else {
      Invoke-WebRequest -Uri "http://localhost:$port" -UseBasicParsing -TimeoutSec 2 | Out-Null
    }
    return $true
  } catch {
    return $false
  }
}

function Get-CloudflaredUrl($exe, $port) {
  $logOut = Join-Path $env:TEMP "pixelium-tunnel-$port-out.log"
  $logErr = Join-Path $env:TEMP "pixelium-tunnel-$port-err.log"
  foreach ($f in @($logOut, $logErr)) { if (Test-Path $f) { Remove-Item $f -Force } }

  $proc = Start-Process -FilePath $exe `
    -ArgumentList @("tunnel", "--url", "http://127.0.0.1:$port") `
    -RedirectStandardOutput $logOut `
    -RedirectStandardError $logErr `
    -PassThru `
    -WindowStyle Hidden

  $deadline = (Get-Date).AddSeconds(60)
  $url = $null
  while ((Get-Date) -lt $deadline) {
    foreach ($f in @($logOut, $logErr)) {
      if (Test-Path $f) {
        $text = Get-Content $f -Raw -ErrorAction SilentlyContinue
        if ($text -match '(https://[a-z0-9-]+\.trycloudflare\.com)') {
          $url = $Matches[1]
          break
        }
      }
    }
    if ($url) { break }
    Start-Sleep -Milliseconds 500
  }

  if (-not $url) {
    if ($proc -and -not $proc.HasExited) { $proc.Kill() }
    throw "Could not get public URL for port $port. Check $logOut"
  }

  return @{ Url = $url; Process = $proc; Log = $logOut }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Pixelium - Internet (Quick Tunnel)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$cloudflared = Get-CloudflaredExe
if (-not $cloudflared) {
  Write-Host "cloudflared is not installed." -ForegroundColor Red
  Write-Host "  winget install Cloudflare.cloudflared" -ForegroundColor Yellow
  exit 1
}

if (-not (Test-Port 4000)) {
  Write-Host "Broker is not running on port 4000." -ForegroundColor Red
  Write-Host "Start the app first: npm run dev" -ForegroundColor Yellow
  exit 1
}

Write-Host "[1/4] Public tunnel for broker (4000)..." -ForegroundColor White
$brokerTunnel = Get-CloudflaredUrl $cloudflared 4000
$brokerUrl = $brokerTunnel.Url
Write-Host "      Broker: $brokerUrl" -ForegroundColor Green

Write-Host "[2/4] Dashboard broker URL..." -ForegroundColor White
$existingDash = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($existingDash) {
  Write-Host "      Port 3000 in use - restart dashboard with public broker URL:" -ForegroundColor Yellow
  Write-Host "      `$env:BROKER_URL='$brokerUrl'; npm run dev:dashboard" -ForegroundColor White
}
else {
  $env:BROKER_URL = $brokerUrl
  Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev:dashboard") -WorkingDirectory $root -WindowStyle Hidden
  Start-Sleep -Seconds 6
}

if (-not (Test-Port 3000)) {
  Write-Host "Dashboard not on port 3000. Run:" -ForegroundColor Red
  Write-Host "  `$env:BROKER_URL='$brokerUrl'; npm run dev:dashboard" -ForegroundColor Yellow
  exit 1
}

Write-Host "[3/4] Public tunnel for store (3000)..." -ForegroundColor White
$storeTunnel = Get-CloudflaredUrl $cloudflared 3000
$storeUrl = $storeTunnel.Url
Write-Host "      Store:  $storeUrl" -ForegroundColor Green

Write-Host "[4/4] Saving tunnel-urls.txt..." -ForegroundColor White
$info = @(
  "Pixelium public URLs (Cloudflare Quick Tunnel)",
  "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
  "",
  "STORE (share this link):",
  "  $storeUrl",
  "",
  "Broker API:",
  "  $brokerUrl",
  "",
  "Login: demo@pixelium.com / demo123",
  "",
  "Keep this PC on. Press Ctrl+C here to stop tunnels.",
  "Permanent hosting: docs/INTERNET.md"
)
$infoPath = Join-Path $root "tunnel-urls.txt"
$info | Set-Content -Encoding UTF8 $infoPath

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  YOUR STORE IS ON THE INTERNET" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Share: $storeUrl" -ForegroundColor Cyan
Write-Host "  Login: demo@pixelium.com / demo123" -ForegroundColor Gray
Write-Host ""
Write-Host "  If AI/login fails, restart dashboard with:" -ForegroundColor Yellow
Write-Host "  `$env:BROKER_URL='$brokerUrl'; npm run dev:dashboard" -ForegroundColor White
Write-Host ""

try {
  while ($true) { Start-Sleep -Seconds 3600 }
}
finally {
  foreach ($t in @($brokerTunnel, $storeTunnel)) {
    if ($t.Process -and -not $t.Process.HasExited) { $t.Process.Kill() }
  }
}
