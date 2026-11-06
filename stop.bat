@echo off
title PJK Passport Photo Studio - Stop
echo =====================================================================
echo           Stopping PJK Passport Photo Automation Studio
echo                       PJK Xerox Printing Shop
echo =====================================================================
echo.

echo [1/2] Terminating server on port 8000 (Backend)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do (
    echo Stopping Backend PID %%a...
    taskkill /F /PID %%a >nul 2>&1
)

echo [2/2] Terminating server on port 5173 (Frontend)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do (
    echo Stopping Frontend PID %%a...
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo =====================================================================
echo [OK] All PJK Passport Studio processes have been stopped safely.
echo =====================================================================
echo.
timeout /t 2 >nul

