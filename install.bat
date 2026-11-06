@echo off
title PJK Passport Photo Studio - Installation
echo =====================================================================
echo           PJK Passport Photo Automation Studio - Setup
echo                       PJK Xerox Printing Shop
echo =====================================================================
echo.

cd /d "%~dp0"

echo [1/4] Checking Python installation...
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in system PATH.
    echo Please install Python 3.10+ from https://www.python.org/
    pause
    exit /b 1
)
python --version

echo.
echo [2/4] Installing Python backend dependencies...
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo [ERROR] Failed to install Python dependencies.
    pause
    exit /b 1
)

echo.
echo [3/4] Installing Node.js frontend dependencies...
cd frontend
call npm --version >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Node.js is not installed or not in PATH.
    echo If you want to run Vite dev mode, please install Node.js.
    echo The backend will still be able to run if dist/ is already built.
) else (
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install encountered errors.
        cd ..
        pause
        exit /b 1
    )
    echo Building production web assets...
    call npm run build
)
cd ..

echo.
echo [4/4] Creating local workspace directories...
if not exist "backend\uploads" mkdir backend\uploads
if not exist "backend\outputs" mkdir backend\outputs
if not exist "backend\temp" mkdir backend\temp

echo.
echo =====================================================================
echo [SUCCESS] Installation completed successfully!
echo You can now double-click 'start.bat' to launch PJK Passport Studio.
echo =====================================================================
echo.
pause

