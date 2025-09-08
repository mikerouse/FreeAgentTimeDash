@echo off
echo.
echo 🚀 FreeAgent Time Tracker - Desktop App Setup
echo ==============================================

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js not found. Please install Node.js 16+ first.
    echo    Download from: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js detected: 
node --version

echo.
echo 📦 Installing dependencies...
call npm install
if errorlevel 1 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo ✅ Dependencies installed successfully

REM Create icons directory
if not exist "assets\icons" (
    echo.
    echo 📁 Creating assets directory...
    mkdir assets\icons
    echo ✅ Assets directory created
)

REM Create placeholder icons
echo.
echo 🎨 Creating placeholder icons...
echo. > assets\icons\icon.png
echo. > assets\icons\icon.ico
echo. > assets\icons\icon.icns
echo. > assets\icons\tray-icon.png
echo. > assets\icons\timer-active.png
echo ✅ Icon placeholders created

echo.
echo ⚙️ Configuration Check
echo ======================

findstr /C:"YOUR_DESKTOP_CLIENT_ID" src\renderer\js\freeagent-api.js >nul
if not errorlevel 1 (
    echo ⚠️  FreeAgent API not configured yet
    echo    Please update src\renderer\js\freeagent-api.js with your:
    echo    - Client ID
    echo    - Client Secret
    echo.
    echo    Get these from: https://dev.freeagent.com
) else (
    echo ✅ FreeAgent API configured
)

echo.
echo 🎉 Setup Complete!
echo ==================
echo.
echo Next steps:
echo 1. Configure FreeAgent API credentials (if not done)
echo 2. Add proper app icons to assets\icons\
echo 3. Run the app:
echo.
echo    npm run dev     ^# Development mode
echo    npm run build   ^# Production build
echo.
echo For more information, see README.md and QUICKSTART.md
echo.
pause