# Expose Pixelium using localtunnel (no extra install - uses npx).
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

function Test-Port($port) {
  try {
    if ($port -eq 4000) {
      Invoke-RestMethod -Uri "http://localhost:$port/health" -TimeoutSec 2 | Out-Null
    } else {
      Invoke-WebRequest -Uri "http://localhost:$port" -UseBasicParsing -TimeoutSec 2 | Out-Null
    }
    return $true
  } catch { return $false }
}

Write-Host ""
Write-Host "Pixelium - Internet (localtunnel)" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Port 4000)) {
  Write-Host "Start the app first: npm run dev" -ForegroundColor Red
  exit 1
}

Write-Host "Starting broker tunnel (port 4000)..." -ForegroundColor White
$brokerLogOut = Join-Path $env:TEMP "pixelium-lt-broker-out.log"
$brokerLogErr = Join-Path $env:TEMP "pixelium-lt-broker-err.log"
foreach ($f in @($brokerLogOut, $brokerLogErr)) { if (Test-Path $f) { Remove-Item $f -Force } }
$brokerProc = Start-Process -FilePath "npx.cmd" `
  -ArgumentList @("--yes", "localtunnel", "--port", "4000") `
  -RedirectStandardOutput $brokerLogOut `
  -RedirectStandardError $brokerLogErr `
  -PassThru -WindowStyle Hidden -WorkingDirectory $root

$brokerUrl = $null
$deadline = (Get-Date).AddSeconds(90)
while ((Get-Date) -lt $deadline) {
  foreach ($f in @($brokerLogOut, $brokerLogErr)) {
    if (Test-Path $f) {
      $t = Get-Content $f -Raw -ErrorAction SilentlyContinue
      if ($t -match '(https://[a-z0-9-]+\.loca\.lt)') { $brokerUrl = $Matches[1]; break }
    }
  }
  if ($brokerUrl) { break }
  Start-Sleep -Milliseconds 800
}
if (-not $brokerUrl) {
  Write-Host "Broker tunnel failed. Try: npm run expose (needs cloudflared)" -ForegroundColor Red
  exit 1
}
Write-Host "  Broker: $brokerUrl" -ForegroundColor Green

Write-Host "Restart dashboard with public broker URL..." -ForegroundColor White
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | ForEach-Object {
  Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 2
$env:BROKER_URL = $brokerUrl
Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev:dashboard") -WorkingDirectory $root -WindowStyle Hidden
Start-Sleep -Seconds 6

if (-not (Test-Port 3000)) {
  Write-Host "Dashboard failed. Run manually:" -ForegroundColor Red
  Write-Host "  `$env:BROKER_URL='$brokerUrl'; npm run dev:dashboard" -ForegroundColor Yellow
  exit 1
}

Write-Host "Starting store tunnel (port 3000)..." -ForegroundColor White
$storeLogOut = Join-Path $env:TEMP "pixelium-lt-store-out.log"
$storeLogErr = Join-Path $env:TEMP "pixelium-lt-store-err.log"
foreach ($f in @($storeLogOut, $storeLogErr)) { if (Test-Path $f) { Remove-Item $f -Force } }
$storeProc = Start-Process -FilePath "npx.cmd" `
  -ArgumentList @("--yes", "localtunnel", "--port", "3000") `
  -RedirectStandardOutput $storeLogOut `
  -RedirectStandardError $storeLogErr `
  -PassThru -WindowStyle Hidden -WorkingDirectory $root

$storeUrl = $null
$deadline = (Get-Date).AddSeconds(90)
while ((Get-Date) -lt $deadline) {
  foreach ($f in @($storeLogOut, $storeLogErr)) {
    if (Test-Path $f) {
      $t = Get-Content $f -Raw -ErrorAction SilentlyContinue
      if ($t -match '(https://[a-z0-9-]+\.loca\.lt)') { $storeUrl = $Matches[1]; break }
    }
  }
  if ($storeUrl) { break }
  Start-Sleep -Milliseconds 800
}
if (-not $storeUrl) {
  Write-Host "Store tunnel failed." -ForegroundColor Red
  exit 1
}

@(
  "STORE: $storeUrl",
  "BROKER: $brokerUrl",
  "Login: demo@pixelium.com / demo123"
) | Set-Content (Join-Path $root "tunnel-urls.txt") -Encoding UTF8

Write-Host ""
Write-Host "YOUR STORE IS ONLINE:" -ForegroundColor Green
Write-Host "  $storeUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "First visit may ask for localtunnel password - use your public IP from https://ifconfig.me" -ForegroundColor Yellow
Write-Host "Login: demo@pixelium.com / demo123" -ForegroundColor Gray
Write-Host "Keep this window open. Ctrl+C to stop." -ForegroundColor Yellow
Write-Host ""

try { while ($true) { Start-Sleep -Seconds 3600 } }
finally {
  foreach ($p in @($brokerProc, $storeProc)) {
    if ($p -and -not $p.HasExited) { $p.Kill() }
  }
}
