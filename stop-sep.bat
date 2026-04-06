@echo off
title SEP Stop
color 0C

echo ============================================================
echo    SEP - Stopping All Services
echo ============================================================
echo.

echo [1/2] Closing service windows...
taskkill /FI "WINDOWTITLE eq SEP-Backend*" /F 2>nul
taskkill /FI "WINDOWTITLE eq SEP-ML*" /F 2>nul
taskkill /FI "WINDOWTITLE eq SEP-Frontend*" /F 2>nul

echo [2/2] Stopping Docker containers...
docker-compose down 2>nul

echo.
echo All SEP services have been stopped.
pause
