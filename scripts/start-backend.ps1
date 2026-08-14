$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

. (Join-Path $root 'scripts\resolve-node.ps1')
. (Join-Path $root 'scripts\port-guard.ps1')

$backend = Join-Path $root 'backend'
if (-not (Test-Path (Join-Path $backend 'node_modules'))) {
  Write-Host "Run install.bat first." -ForegroundColor Yellow
  exit 1
}

Assert-PortFree -Port 3001 -Label 'Backend API'

Write-Host "Starting backend API at http://localhost:3001" -ForegroundColor Green
Write-Host "Keep this window open while using the app. Stop: Ctrl+C"
Write-Host ""

Set-Location $backend
if ($env:NODE_OPTIONS) {
  if ($env:NODE_OPTIONS -notmatch 'experimental-sqlite') {
    $env:NODE_OPTIONS = "$env:NODE_OPTIONS --experimental-sqlite"
  }
} else {
  $env:NODE_OPTIONS = '--experimental-sqlite'
}
npm run dev
