# Create a clean deploy archive (keeps folder structure, skips node_modules)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$out = Join-Path (Split-Path $root -Parent) "pixelium-deploy.tar.gz"

Set-Location $root

if (Test-Path $out) { Remove-Item $out -Force }

Write-Host "Creating $out ..." -ForegroundColor Cyan
tar -czf $out `
  --exclude=node_modules `
  --exclude=.git `
  --exclude=data `
  --exclude=.cursor `
  --exclude=**/__pycache__ `
  --exclude=.pytest_cache `
  .

$size = [math]::Round((Get-Item $out).Length / 1MB, 1)
Write-Host "Done: $out ($size MB)" -ForegroundColor Green
Write-Host ""
Write-Host "Upload to VM:" -ForegroundColor Yellow
Write-Host "  scp -i `"`$env:USERPROFILE\.ssh\azure_vm`" `"$out`" azureuser@158.158.122.5:/home/azureuser/" -ForegroundColor White
