@echo off
title SEP - Stopping All Services
color 0C

echo ============================================================
echo    SEP - Stopping All Services
echo ============================================================
echo.

echo [1/3] Stopping Node.js and Python processes...
taskkill /FI "WINDOWTITLE eq SEP Backend*" /F 2>nul
taskkill /FI "WINDOWTITLE eq SEP ML Service*" /F 2>nul
taskkill /FI "WINDOWTITLE eq SEP Frontend*" /F 2>nul

echo [2/3] Stopping Docker containers...
docker-compose down 2>nul

echo [3/3] Done!
echo.
echo All SEP services have been stopped.
pause
