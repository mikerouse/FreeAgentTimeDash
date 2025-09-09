@echo off
echo.
echo 🔧 IPC Diagnostic Test
echo =====================

echo 📋 Testing IPC communication specifically...

REM First, run the minimal IPC test
echo.
echo 🧪 Running minimal IPC test...
echo This will open a simple window to test if IPC handlers work.
echo.

call npm run test-ipc

pause