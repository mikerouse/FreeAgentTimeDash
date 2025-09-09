@echo off
echo.
echo 🚀 Quick Start - FreeAgent Time Tracker
echo ======================================

REM Check if we have node_modules
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    call npm install
)

REM Check if electron-store is installed
if not exist "node_modules\electron-store" (
    echo 📦 Installing electron-store...
    call npm install electron-store
)

echo ✅ Dependencies ready

REM Run syntax check on critical files
echo.
echo 🔍 Checking syntax...

set "files=main-simple.js preload-simple.js src\renderer\js\storage-adapter-simple.js src\renderer\js\time-tracker-clean.js"

for %%f in (%files%) do (
    if exist "%%f" (
        node -c "%%f" >nul 2>&1
        if not errorlevel 1 (
            echo ✅ %%f
        ) else (
            echo ❌ %%f has syntax errors
            pause
            exit /b 1
        )
    ) else (
        echo ⚠️  Missing: %%f
    )
)

echo.
echo 🚀 Starting Electron app...
echo.

REM Set development environment
set NODE_ENV=development

REM Run the app
call npm run dev

pause