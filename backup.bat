@echo off
cd /d "%~dp0"
title Vilar OP - Backup
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\backup-data.ps1"
if errorlevel 1 (
  echo Backup failed.
  pause
  exit /b 1
)
pause
