$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

. (Join-Path $root 'scripts\resolve-node.ps1')
. (Join-Path $root 'scripts\port-guard.ps1')

$frontend = Join-Path $root 'frontend'
if (-not (Test-Path (Join-Path $frontend 'node_modules'))) {
  Write-Host "Run install.bat first." -ForegroundColor Yellow
  exit 1
}

Assert-PortFree -Port 5173 -Label 'Frontend UI'

Write-Host "Starting UI at http://localhost:5173" -ForegroundColor Green
Write-Host "Backend must already be running (start-backend.bat)."
Write-Host "Stop: Ctrl+C"
Write-Host ""

Start-Process powershell -ArgumentList '-NoProfile','-Command','Start-Sleep -Seconds 3; Start-Process http://localhost:5173' -WindowStyle Hidden

Set-Location $frontend
npm run dev
