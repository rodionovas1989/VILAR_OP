@echo off
cd /d "%~dp0"
title Vilar OP - Restart all

where powershell >nul 2>&1
if errorlevel 1 (
  echo ERROR: PowerShell not found.
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\restart-all.ps1"
if errorlevel 1 (
  echo.
  pause
  exit /b 1
)
