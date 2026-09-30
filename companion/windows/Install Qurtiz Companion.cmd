@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0companion\windows\install.ps1" -Source "%~dp0."
if errorlevel 1 (
  echo.
  echo Installation failed. Press any key to close.
  pause >nul
  exit /b 1
)
