@echo off
echo.
echo 🐛 FreeAgent Time Tracker - Debug Mode
echo ======================================

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ Not in project directory. Please run from FreeAgentTimeDashCode\
    pause
    exit /b 1
)

echo 📁 Current directory: %CD%

REM Check Node.js
echo.
echo 🔍 Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js not found. Please install Node.js 16+
    pause
    exit /b 1
) else (
    echo ✅ Node.js found:
    node --version
)

REM Check dependencies
echo.
echo 📦 Checking dependencies...
if exist "node_modules" (
    echo ✅ node_modules found
) else (
    echo ⚠️  node_modules not found. Running npm install...
    call npm install
)

REM Check critical files
echo.
echo 📄 Checking critical files...

set "files=main.js preload.js src\renderer\index.html src\renderer\js\storage-adapter.js src\renderer\js\freeagent-api.js src\renderer\js\time-tracker-clean.js src\renderer\js\app.js"

set "all_files_exist=true"
for %%f in (%files%) do (
    if exist "%%f" (
        echo ✅ %%f
    ) else (
        echo ❌ Missing: %%f
        set "all_files_exist=false"
    )
)

if "%all_files_exist%"=="false" (
    echo.
    echo ❌ Some critical files are missing. Please check the project structure.
    pause
    exit /b 1
)

REM Check for syntax errors
echo.
echo 🔍 Checking for JavaScript syntax errors...

set "js_files=src\renderer\js\storage-adapter.js src\renderer\js\freeagent-api.js src\renderer\js\time-tracker-clean.js src\renderer\js\app.js"

for %%f in (%js_files%) do (
    node -c "%%f" >nul 2>&1
    if not errorlevel 1 (
        echo ✅ %%f - syntax OK
    ) else (
        echo ❌ %%f - syntax error
        echo    Run: node -c "%%f"
    )
)

REM Test options
echo.
echo 🧪 Test Options:
echo 1. Open test page in browser: file://%CD:\=/%/test.html
echo 2. Run Electron app: npm run dev
echo.

set /p choice="Would you like to (1) open test page, (2) run app, or (q) quit? "

if "%choice%"=="1" (
    echo Opening test page...
    start "" "test.html"
) else if "%choice%"=="2" (
    echo Starting Electron app...
    call npm run dev
) else if /i "%choice%"=="q" (
    echo Goodbye!
) else (
    echo Invalid choice. Run script again to try.
)

echo.
pause