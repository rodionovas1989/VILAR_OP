# Install dependencies for Vilar OP (Windows)
$ErrorActionPreference = 'Stop'
try {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

function Write-Step($msg) {
  Write-Host ""
  Write-Host ">>> $msg" -ForegroundColor Cyan
}

Write-Step "Checking Node.js"

$nodeDir = Join-Path $root '.tools\node'
$nodeExe = Join-Path $nodeDir 'node.exe'
$npmCmd = Join-Path $nodeDir 'npm.cmd'

if (-not (Test-Path $nodeExe)) {
  Write-Host "Portable Node.js not found in .tools\node"
  Write-Host "Trying system Node.js..."
  $sys = Get-Command node -ErrorAction SilentlyContinue
  if (-not $sys) {
    Write-Host ""
    Write-Host "Node.js is not installed." -ForegroundColor Red
    Write-Host "Option 1: put portable Node into .tools\node"
    Write-Host "Option 2: install Node.js LTS from https://nodejs.org and run install.bat again"
    exit 1
  }
  $nodeExe = $sys.Source
  $npmCmd = 'npm'
} else {
  $env:Path = "$nodeDir;$env:Path"
}

Write-Host ("Node: " + (& $nodeExe -v))
Write-Host ("npm:  " + (& $npmCmd -v))

Write-Step "Installing backend packages"
Push-Location (Join-Path $root 'backend')
& $npmCmd install
if ($LASTEXITCODE -ne 0) { Pop-Location; throw 'npm install failed in backend' }
Pop-Location

Write-Step "Installing frontend packages"
Push-Location (Join-Path $root 'frontend')
& $npmCmd install
if ($LASTEXITCODE -ne 0) { Pop-Location; throw 'npm install failed in frontend' }
Pop-Location

Write-Step "Preparing database"
$sqlitePath = Join-Path $root 'backend\data\vilar.sqlite'
if (Test-Path $sqlitePath) {
  Write-Host "Found existing vilar.sqlite — seed skipped (working data kept)."
  Write-Host "To rebuild demo data: cd backend && npm run seed"
} else {
  Write-Step "Creating demo data (seed)"
  Push-Location (Join-Path $root 'backend')
  & $npmCmd run seed
  if ($LASTEXITCODE -ne 0) { Pop-Location; throw 'seed failed' }
  Pop-Location
}

Write-Host ""
Write-Host "Installation completed successfully." -ForegroundColor Green
Write-Host "Run start-all.bat (or start-backend.bat then start-frontend.bat)."
Write-Host "start-all.bat does not recreate data."
