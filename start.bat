@echo off
setlocal EnableDelayedExpansion
title PJK Passport Photo Studio Launcher
echo =====================================================================
echo           PJK Passport Photo Automation Studio - Launcher
echo                       PJK Xerox Printing Shop
echo =====================================================================
echo.

cd /d "%~dp0"

echo [1/4] Cleaning up any old processes on ports 8000 and 5173...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetTCPConnection -LocalPort 8000, 5173 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo.
echo [2/4] Starting Backend Server [FastAPI on port 8000]...
pushd "%~dp0backend"
start "PJK Studio Backend [Port 8000]" cmd /k "title PJK Studio Backend [Port 8000] && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
popd

echo Waiting for backend server initialization...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ready = $false; for ($i=0; $i -lt 25; $i++) { try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:8000/api/health' -UseBasicParsing -TimeoutSec 1; if ($r.StatusCode -eq 200) { $ready = $true; break } } catch {}; Start-Sleep -Milliseconds 400 }; if ($ready) { Write-Host ' [OK] Backend server is ready!' -ForegroundColor Green } else { Write-Host ' [WARN] Backend took longer to respond. Proceeding...' -ForegroundColor Yellow }"

set TARGET_URL=http://127.0.0.1:8000

echo.
call npm --version >nul 2>&1
if errorlevel 1 goto LAUNCH_BROWSER

echo [3/4] Starting Frontend Dashboard [Vite on port 5173]...
pushd "%~dp0frontend"
start "PJK Studio Frontend [Port 5173]" cmd /k "title PJK Studio Frontend [Port 5173] && npm run dev"
popd
set TARGET_URL=http://localhost:5173

echo Waiting for frontend dashboard...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ready = $false; for ($i=0; $i -lt 25; $i++) { try { $r = Invoke-WebRequest -Uri 'http://localhost:5173' -UseBasicParsing -TimeoutSec 1; if ($r.StatusCode -eq 200) { $ready = $true; break } } catch {}; Start-Sleep -Milliseconds 400 }; if ($ready) { Write-Host ' [OK] Frontend dashboard is ready!' -ForegroundColor Green } else { Write-Host ' [WARN] Frontend took longer to respond. Proceeding...' -ForegroundColor Yellow }"

:LAUNCH_BROWSER
echo.
echo [4/4] Opening Studio Dashboard in your web browser...
echo =====================================================================
echo  Application is now running!
echo.
echo  - Studio Dashboard:     %TARGET_URL%
echo  - Backend API URL:      http://127.0.0.1:8000
echo  - API Documentation:    http://127.0.0.1:8000/docs
echo  - System Diagnostics:   http://127.0.0.1:8000/api/health
echo.
echo  To stop the application, simply double-click 'stop.bat'.
echo =====================================================================
echo.

start %TARGET_URL%
