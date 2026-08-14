# Проверка занятости портов Vilar OP (backend 3001, frontend 5173)

function Get-PortListenerPids {
  param([int]$Port)
  $pids = @(
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique
  )
  return $pids | Where-Object { $_ -and $_ -ne 0 }
}

function Get-PortListenerInfo {
  param([int]$Port)
  $listenerPid = (Get-PortListenerPids -Port $Port | Select-Object -First 1)
  if (-not $listenerPid) { return $null }
  $proc = Get-Process -Id $listenerPid -ErrorAction SilentlyContinue
  return [PSCustomObject]@{
    Port = $Port
    Pid = $listenerPid
    Name = if ($proc) { $proc.ProcessName } else { 'unknown' }
  }
}

function Stop-PortListeners {
  param([int[]]$Ports)
  foreach ($port in $Ports) {
    foreach ($listenerPid in Get-PortListenerPids -Port $port) {
      Write-Host "Stopping PID $listenerPid on port $port..." -ForegroundColor Yellow
      Stop-Process -Id $listenerPid -Force -ErrorAction SilentlyContinue
    }
  }
  Start-Sleep -Seconds 1
}

function Assert-PortFree {
  param(
    [int]$Port,
    [string]$Label,
    [switch]$Force
  )
  if ($Force) {
    Stop-PortListeners -Ports @($Port)
    return
  }
  $info = Get-PortListenerInfo -Port $Port
  if ($info) {
    Write-Host ""
    Write-Host "ERROR: $Label already running on port $Port (process $($info.Name), PID $($info.Pid))." -ForegroundColor Red
    Write-Host "Stop that window (Ctrl+C) or run restart-all.bat to restart cleanly."
    Write-Host ""
    exit 1
  }
}
