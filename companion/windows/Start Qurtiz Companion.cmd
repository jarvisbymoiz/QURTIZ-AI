@echo off
cd /d "%~dp0"
"%~dp0node.exe" "%~dp0companion\windows\start.mjs"
echo.
echo Qurtiz Companion stopped. Press any key to close.
pause >nul
