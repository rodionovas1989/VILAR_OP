@echo off
cd /d "%~dp0"
title Vilar OP - Start all

if not exist "%~dp0start-backend.bat" (
  echo ERROR: start-backend.bat not found
  pause
  exit /b 1
)
if not exist "%~dp0backend\node_modules\" (
  echo ERROR: dependencies missing. Run install.bat first.
  pause
  exit /b 1
)

echo Starting backend in a new window...
start "Vilar OP Backend" "%~dp0start-backend.bat"

timeout /t 3 /nobreak >nul

echo Starting frontend in this window...
call "%~dp0start-frontend.bat"
