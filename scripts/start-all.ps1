$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

. (Join-Path $root 'scripts\port-guard.ps1')

if (-not (Test-Path (Join-Path $root 'backend\node_modules'))) {
  Write-Host "ERROR: dependencies missing. Run install.bat first." -ForegroundColor Red
  exit 1
}

Assert-PortFree -Port 3001 -Label 'Backend API'
Assert-PortFree -Port 5173 -Label 'Frontend UI'

Write-Host "Starting backend in a new window..." -ForegroundColor Cyan
Start-Process -FilePath (Join-Path $root 'start-backend.bat') -WorkingDirectory $root

Start-Sleep -Seconds 3

Write-Host "Starting frontend in this window..." -ForegroundColor Cyan
& (Join-Path $root 'scripts\start-frontend.ps1')
