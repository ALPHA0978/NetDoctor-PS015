@echo off
setlocal
cd /d "%~dp0"
where python.exe >nul 2>nul
if errorlevel 1 (
  echo Python was not found. Install Python and add it to PATH.
  pause
  exit /b 1
)
if not exist "web\out\index.html" (
  echo The built web export is missing. See README.md to rebuild.
  pause
  exit /b 1
)
python.exe web_demo.py
if errorlevel 1 pause
