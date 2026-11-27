@echo off
setlocal
cd /d "%~dp0"
if not defined NETDOCTOR_GEMINI_KEY_FILE set "NETDOCTOR_GEMINI_KEY_FILE=%~dp0.env.gemini.dpapi"
set "APP=%~dp0desktop\release\NetDoctor-win-x64\NetDoctor.exe"
if /i "%PROCESSOR_ARCHITECTURE%"=="ARM64" if exist "%~dp0desktop\release\NetDoctor-win-arm64\NetDoctor.exe" set "APP=%~dp0desktop\release\NetDoctor-win-arm64\NetDoctor.exe"
where python.exe >nul 2>nul
if errorlevel 1 (
  where py.exe >nul 2>nul
  if errorlevel 1 (
    echo Python 3 was not found. Install Python 3, then launch again.
    pause
    exit /b 1
  )
)
if exist "%APP%" (
  start "" "%APP%"
  exit /b
)
if not exist "%~dp0desktop\node_modules\.bin\electron.cmd" (
  echo Install the desktop dependencies with npm ci --prefix desktop, then launch again.
  pause
  exit /b 1
)
call npm.cmd --prefix "%~dp0desktop" start
if errorlevel 1 pause
