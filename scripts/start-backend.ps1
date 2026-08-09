$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

. (Join-Path $root 'scripts\resolve-node.ps1')

$backend = Join-Path $root 'backend'
if (-not (Test-Path (Join-Path $backend 'node_modules'))) {
  Write-Host "Run install.bat first." -ForegroundColor Yellow
  exit 1
}

Write-Host "Starting backend API at http://localhost:3001" -ForegroundColor Green
Write-Host "Keep this window open while using the app. Stop: Ctrl+C"
Write-Host ""

Set-Location $backend
npm run dev
