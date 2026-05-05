@echo off
title SEP Platform Launcher
color 0A

echo ============================================================
echo    SEP - Smart Enterprise Platform Launcher
echo    Student: Saqqaf Al-Yazidi (TP075880)
echo ============================================================
echo.

set "PROJECT_ROOT=%~dp0"

echo Select launch mode:
echo   [1] Docker (all services in containers - recommended)
echo   [2] Local  (services run natively, only DB in Docker)
echo.
set /p MODE="Enter choice (1 or 2): "

if "%MODE%"=="1" goto DOCKER_MODE
if "%MODE%"=="2" goto LOCAL_MODE
echo Invalid choice. Defaulting to Docker mode.
goto DOCKER_MODE

REM ============================================================
REM  DOCKER MODE - Everything in containers
REM ============================================================
:DOCKER_MODE
echo.
echo [1/3] Building and starting all services via Docker Compose...
cd /d "%PROJECT_ROOT%"
docker-compose up --build -d
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Docker Compose failed. Make sure Docker Desktop is running.
    pause
    exit /b 1
)

echo.
echo [2/3] Waiting for services to be healthy...

:WAIT_BACKEND
timeout /t 3 /nobreak >nul
docker inspect --format="{{.State.Health.Status}}" sep-backend 2>nul | findstr "healthy" >nul
if %ERRORLEVEL% NEQ 0 (
    echo       Backend starting...
    goto WAIT_BACKEND
)
echo       Backend is healthy!

echo.
echo [3/3] All services are running!
echo.
echo ============================================================
echo    Frontend:    http://localhost:5173
echo    Backend:     http://localhost:3000/api/v1/health
echo    ML Service:  http://localhost:8000/health
echo    PostgreSQL:  localhost:5432
echo.
echo    Login: super@sep.com / super123456
echo.
echo    To stop:  docker-compose down
echo    To logs:  docker-compose logs -f
echo ============================================================
echo.
pause
exit /b 0

REM ============================================================
REM  LOCAL MODE - Only DB in Docker, services run natively
REM ============================================================
:LOCAL_MODE
set "BACKEND_DIR=%PROJECT_ROOT%backend"
set "FRONTEND_DIR=%PROJECT_ROOT%frontend"
set "ML_DIR=%PROJECT_ROOT%ml-service"

echo.
echo [1/6] Starting PostgreSQL database...
cd /d "%PROJECT_ROOT%"
docker-compose up -d postgres 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Docker failed. Make sure Docker Desktop is running.
    pause
    exit /b 1
)

echo       Waiting for PostgreSQL to be ready...
:WAIT_PG
timeout /t 2 /nobreak >nul
docker exec sep-postgres pg_isready -U sep_admin >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo       Still waiting...
    goto WAIT_PG
)
echo       PostgreSQL is ready!
echo.

echo [2/6] Checking backend dependencies...
if not exist "%BACKEND_DIR%\node_modules" (
    echo       Installing backend dependencies...
    cd /d "%BACKEND_DIR%"
    call npm install
) else (
    echo       Backend dependencies already installed.
)
echo.

echo [3/6] Setting up database schema and seed data...
cd /d "%BACKEND_DIR%"
call npx prisma generate --schema=src/prisma/schema.prisma
call npx prisma db push --schema=src/prisma/schema.prisma
echo       Running seed script...
call npx tsx src/prisma/seed.ts 2>nul
echo       Database setup complete!
echo.

echo [4/6] Checking frontend dependencies...
if not exist "%FRONTEND_DIR%\node_modules" (
    echo       Installing frontend dependencies...
    cd /d "%FRONTEND_DIR%"
    call npm install
) else (
    echo       Frontend dependencies already installed.
)
echo.

echo [5/6] Checking ML service dependencies...
cd /d "%ML_DIR%"
pip show fastapi >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo       Installing ML service dependencies...
    pip install -r requirements.txt 2>nul
)
echo       Generating ML training data...
py -m app.data.generate_data 2>nul
if %ERRORLEVEL% NEQ 0 (
    python -m app.data.generate_data 2>nul
)
echo       ML data ready!
echo.

echo [6/6] Launching all services...
echo.

cd /d "%BACKEND_DIR%"
start "SEP-Backend" cmd /k "echo === SEP BACKEND on port 3000 === && npm run dev"

timeout /t 3 /nobreak >nul

cd /d "%ML_DIR%"
start "SEP-ML" cmd /k "echo === SEP ML SERVICE on port 8000 === && py -m uvicorn app.main:app --reload --port 8000"

cd /d "%FRONTEND_DIR%"
start "SEP-Frontend" cmd /k "echo === SEP FRONTEND on port 5173 === && npm run dev"

echo.
echo ============================================================
echo    All services are starting!
echo.
echo    Frontend:    http://localhost:5173
echo    Backend:     http://localhost:3000
echo    ML Service:  http://localhost:8000
echo    PostgreSQL:  localhost:5432
echo.
echo    Login: super@sep.com / super123456
echo.
echo    To stop: close the 3 service windows, then run stop-sep.bat
echo ============================================================
echo.
pause
exit /b 0
