@echo off
cd /d "%~dp0"
title Vilar OP - Frontend

where powershell >nul 2>&1
if errorlevel 1 (
  echo ERROR: PowerShell not found.
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-frontend.ps1"
if errorlevel 1 (
  echo.
  echo Frontend failed. Run install.bat first.
  pause
  exit /b 1
)
