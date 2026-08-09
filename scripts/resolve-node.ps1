# Adds Node.js to PATH (portable .tools or system)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$portableDir = Join-Path $root '.tools\node'
$portable = Join-Path $portableDir 'node.exe'

if (Test-Path $portable) {
  $env:Path = "$portableDir;$env:Path"
} elseif (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js not found. Run install.bat first."
}
