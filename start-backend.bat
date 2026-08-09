@echo off
cd /d "%~dp0"
title Vilar OP - Backend

where powershell >nul 2>&1
if errorlevel 1 (
  echo ERROR: PowerShell not found.
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-backend.ps1"
if errorlevel 1 (
  echo.
  echo Backend failed. Run install.bat first.
  pause
  exit /b 1
)
