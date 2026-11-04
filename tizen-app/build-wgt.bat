@echo off
echo Packaging Tizen application into VarahovbaCinema.wgt...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-wgt.ps1"
pause
