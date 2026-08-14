$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

. (Join-Path $root 'scripts\port-guard.ps1')

Write-Host "Stopping existing Vilar OP servers (ports 3001, 5173-5175)..." -ForegroundColor Yellow
Stop-PortListeners -Ports @(3001, 5173, 5174, 5175)

Write-Host "Starting fresh..." -ForegroundColor Green
& (Join-Path $root 'scripts\start-all.ps1')
