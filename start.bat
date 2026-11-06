@echo off
title PJK Passport Photo Studio Launcher
echo =====================================================================
echo           PJK Passport Photo Automation Studio - Launcher
echo                       PJK Xerox Printing Shop
echo =====================================================================
echo.

cd /d "%~dp0"

echo [1/3] Starting Backend Server (FastAPI + Photoshop Service on port 8000)...
start "PJK Studio Backend (Port 8000)" cmd /c "cd /d ""%~dp0backend"" && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000"

echo [2/3] Starting Frontend Dashboard (Vite on port 5173)...
start "PJK Studio Frontend (Port 5173)" cmd /c "cd /d ""%~dp0frontend"" && npm run dev"

echo [3/3] Waiting for servers to initialize...
timeout /t 3 /nobreak >nul

echo.
echo =====================================================================
echo  Application is now running!
echo.
echo  - Frontend Dashboard:   http://localhost:5173
echo  - Standalone Web App:   http://127.0.0.1:8000
echo  - API Documentation:    http://127.0.0.1:8000/docs
echo  - System Health:        http://127.0.0.1:8000/api/health
echo.
echo  To stop the application, simply run 'stop.bat'.
echo =====================================================================
echo.

echo Launching web browser...
start http://localhost:5173

