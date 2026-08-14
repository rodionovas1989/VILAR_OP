# Copy sqlite (and WAL files) to backups/<timestamp>/
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$dataDir = Join-Path $root 'backend\data'
$stamp = Get-Date -Format 'yyyy-MM-dd-HHmm'
$dest = Join-Path $root "backups\$stamp"
New-Item -ItemType Directory -Force -Path $dest | Out-Null

$copied = 0
foreach ($name in @('vilar.sqlite', 'vilar.sqlite-wal', 'vilar.sqlite-shm', 'auth_secret')) {
  $src = Join-Path $dataDir $name
  if (Test-Path $src) {
    Copy-Item $src (Join-Path $dest $name)
    $copied++
  }
}

if ($copied -eq 0) {
  Write-Host "No sqlite files found in backend\data"
  exit 1
}

Write-Host "Backup saved to $dest"
