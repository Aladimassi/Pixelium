# Create Pixelium VM on Azure via CLI (Azure for Students)
# Run: powershell -ExecutionPolicy Bypass -File scripts/azure-vm.ps1
#
# Prerequisites:
#   winget install Microsoft.AzureCLI
#   az login
#
$ErrorActionPreference = "Stop"

$Rg = "pixelium-rg"
$VmName = "pixelium-vm"
$AdminUser = "azureuser"
$Size = "Standard_B2s"

Write-Host ""
Write-Host "=== Pixelium Azure VM (CLI) ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
  Write-Host "Azure CLI not installed. Run:" -ForegroundColor Red
  Write-Host "  winget install Microsoft.AzureCLI" -ForegroundColor Yellow
  exit 1
}

$account = az account show 2>$null | ConvertFrom-Json
if (-not $account) {
  Write-Host "Not logged in. Run:" -ForegroundColor Red
  Write-Host "  az login" -ForegroundColor Yellow
  exit 1
}

Write-Host "Subscription: $($account.name)" -ForegroundColor Gray
Write-Host ""

# 1) Find allowed regions from policy
Write-Host "[1] Looking for allowed regions..." -ForegroundColor White
$assignments = az policy assignment list -o json | ConvertFrom-Json
$allowed = @()
foreach ($a in $assignments) {
  $name = "$($a.name) $($a.displayName)"
  if ($name -match 'region|Region|emplacement|Emplacement') {
    $locs = $a.parameters.listOfAllowedLocations.value
    if (-not $locs) { $locs = $a.parameters.allowedLocations.value }
    if ($locs) { $allowed += $locs }
  }
}
$allowed = $allowed | Select-Object -Unique

if ($allowed.Count -gt 0) {
  Write-Host "Allowed regions for your subscription:" -ForegroundColor Green
  $allowed | ForEach-Object { Write-Host "  - $_" }
} else {
  Write-Host "Could not read policy. Will try common student regions." -ForegroundColor Yellow
  $allowed = @('eastus', 'eastus2', 'westus2', 'centralus', 'southcentralus', 'westeurope', 'northeurope')
}

# 2) Try each region until VM creates
Write-Host ""
Write-Host "[2] Creating VM (Ubuntu 22.04, $Size)..." -ForegroundColor White

$created = $false
foreach ($loc in $allowed) {
  Write-Host "  Trying $loc ..." -ForegroundColor Gray
  az group delete --name $Rg --yes 2>$null | Out-Null
  Start-Sleep -Seconds 2

  $err = az group create --name $Rg --location $loc 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Host "    Region blocked: $loc" -ForegroundColor DarkYellow
    continue
  }

  $vmOut = az vm create `
    --resource-group $Rg `
    --name $VmName `
    --image Ubuntu2204 `
    --size $Size `
    --location $loc `
    --admin-username $AdminUser `
    --generate-ssh-keys `
    --public-ip-sku Standard `
    --output json 2>&1

  if ($LASTEXITCODE -ne 0) {
    if ($vmOut -match 'NotAvailableForSubscription|Quota|size') {
      Write-Host "    Size $Size not available in $loc, trying Standard_B1s ..." -ForegroundColor Yellow
      $vmOut = az vm create `
        --resource-group $Rg `
        --name $VmName `
        --image Ubuntu2204 `
        --size Standard_B1s `
        --location $loc `
        --admin-username $AdminUser `
        --generate-ssh-keys `
        --public-ip-sku Standard `
        --output json 2>&1
    }
  }

  if ($LASTEXITCODE -eq 0) {
    Write-Host "    SUCCESS in $loc" -ForegroundColor Green
    $created = $true
    break
  }
  Write-Host "    Failed in $loc" -ForegroundColor DarkYellow
  az group delete --name $Rg --yes 2>$null | Out-Null
}

if (-not $created) {
  Write-Host ""
  Write-Host "VM creation failed in all tried regions." -ForegroundColor Red
  Write-Host "Use free tunnel instead: npm run expose:lt" -ForegroundColor Yellow
  exit 1
}

# 3) Open ports
Write-Host ""
Write-Host "[3] Opening ports 22 and 80..." -ForegroundColor White
az vm open-port --resource-group $Rg --name $VmName --port 22 --priority 1001 | Out-Null
az vm open-port --resource-group $Rg --name $VmName --port 80 --priority 1002 | Out-Null

$ip = az vm show -d --resource-group $Rg --name $VmName --query publicIps -o tsv

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  VM READY" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Region:   $loc" -ForegroundColor White
Write-Host "  IP:       $ip" -ForegroundColor Cyan
Write-Host "  SSH:      ssh ${AdminUser}@${ip}" -ForegroundColor White
Write-Host ""
Write-Host "Next on the VM:" -ForegroundColor Yellow
Write-Host "  curl -fsSL https://get.docker.com | sh" -ForegroundColor Gray
Write-Host "  # copy project, then: docker compose up -d --build" -ForegroundColor Gray
Write-Host "  # set BROKER_URL=http://${ip}/broker in .env" -ForegroundColor Gray
Write-Host ""

@(
  "VM_IP=$ip",
  "REGION=$loc",
  "SSH=ssh ${AdminUser}@${ip}",
  "STORE=http://${ip}"
) | Set-Content (Join-Path (Split-Path (Split-Path $MyInvocation.MyCommand.Path -Parent) -Parent) "azure-vm-info.txt") -Encoding UTF8
