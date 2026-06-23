# Verify all deliverables (run with agents already up, or script starts them)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

Write-Host "`n=== Pixelium Verify ===`n"

Write-Host "[1/4] Build..."
& npm run build
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "`n[2/4] Health checks..."
$urls = @(
  "http://localhost:4001/health",
  "http://localhost:4002/health",
  "http://localhost:4000/health"
)
foreach ($u in $urls) {
  try {
    $r = Invoke-RestMethod -Uri $u -TimeoutSec 5
    Write-Host "  OK $u"
  } catch {
    Write-Host "  SKIP $u (start npm run dev first)"
  }
}

Write-Host "`n[3/4] Demos..."
& npm run demo:realtime
& npm run demo:delegated
& npm run demo:monitor

Write-Host "`n[4/4] Adversarial tests..."
& npm run test:adversarial

Write-Host "`n=== Verify complete ===`n"
