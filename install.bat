@echo off
cd /d "%~dp0"
title Vilar OP - Install

echo ========================================
echo   Vilar OP - installation
echo ========================================
echo.

where powershell >nul 2>&1
if errorlevel 1 (
  echo ERROR: PowerShell not found.
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install.ps1"
if errorlevel 1 (
  echo.
  echo Installation failed.
  pause
  exit /b 1
)

echo.
echo Done. Run:
echo   start-all.bat
echo or:
echo   start-backend.bat
echo   start-frontend.bat
echo.
pause
