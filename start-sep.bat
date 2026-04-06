@echo off
title SEP Platform Launcher
color 0A

echo ============================================================
echo    SEP - Smart Enterprise Platform Launcher
echo    Student: Saqqaf Al-Yazidi (TP075880)
echo ============================================================
echo.

REM ---- Configuration ----
set "PROJECT_ROOT=%~dp0"
set "BACKEND_DIR=%PROJECT_ROOT%backend"
set "FRONTEND_DIR=%PROJECT_ROOT%frontend"
set "ML_DIR=%PROJECT_ROOT%ml-service"

REM ---- Step 1: Start PostgreSQL via Docker ----
echo [1/6] Starting PostgreSQL database...
cd /d "%PROJECT_ROOT%"
docker-compose up postgres -d 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Docker failed. Make sure Docker Desktop is running.
    pause
    exit /b 1
)

REM Wait for PostgreSQL to be healthy
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

REM ---- Step 2: Install backend dependencies if needed ----
echo [2/6] Checking backend dependencies...
if not exist "%BACKEND_DIR%\node_modules" (
    echo       Installing backend dependencies...
    cd /d "%BACKEND_DIR%"
    call npm install
) else (
    echo       Backend dependencies already installed.
)
echo.

REM ---- Step 3: Run Prisma migrations and seed ----
echo [3/6] Setting up database schema and seed data...
cd /d "%BACKEND_DIR%"
call npx prisma generate --schema=src/prisma/schema.prisma
call npx prisma db push --schema=src/prisma/schema.prisma
echo       Running seed script...
call npx tsx src/prisma/seed.ts 2>nul
echo       Database setup complete!
echo.

REM ---- Step 4: Install frontend dependencies if needed ----
echo [4/6] Checking frontend dependencies...
if not exist "%FRONTEND_DIR%\node_modules" (
    echo       Installing frontend dependencies...
    cd /d "%FRONTEND_DIR%"
    call npm install
) else (
    echo       Frontend dependencies already installed.
)
echo.

REM ---- Step 5: Install ML dependencies if needed ----
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

REM ---- Step 6: Launch all services in separate windows ----
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
echo    Login: admin@sep.com / admin123456
echo.
echo    To stop: close the 3 service windows, then run stop-sep.bat
echo ============================================================
echo.
pause
