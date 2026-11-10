@echo off
title PJK Passport Photo Studio - Stop
echo =====================================================================
echo           Stopping PJK Passport Photo Automation Studio
echo                       PJK Xerox Printing Shop
echo =====================================================================
echo.

echo [1/2] Terminating servers on ports 8000 and 5173...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Stop-Process -Id (Get-NetTCPConnection -LocalPort 8000, 5173 -ErrorAction SilentlyContinue).OwningProcess -Force -ErrorAction SilentlyContinue"

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo =====================================================================
echo [OK] All PJK Passport Studio processes have been stopped safely.
echo =====================================================================
echo.
timeout /t 2 >nul

