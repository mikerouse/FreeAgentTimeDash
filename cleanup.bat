@echo off
cls
echo.
echo =============================================
echo  CLEANING UP DEVELOPMENT MESS
echo =============================================
echo.
echo This will PERMANENTLY DELETE all development files
echo and leave only the production-ready application.
echo.
echo Press any key to continue or Ctrl+C to cancel...
pause >nul

echo.
echo 🗑️ Deleting development start files...
if exist start-basic.bat del /q start-basic.bat
if exist start-complete.bat del /q start-complete.bat
if exist start-freeagent.bat del /q start-freeagent.bat
if exist start-fixed.bat del /q start-fixed.bat
if exist start-oauth.bat del /q start-oauth.bat
if exist start-oauth-simple.bat del /q start-oauth-simple.bat

echo 🗑️ Deleting development main files...
if exist main-simple.js del /q main-simple.js
if exist main-simple-clean.js del /q main-simple-clean.js
if exist main-oauth.js del /q main-oauth.js
if exist main-oauth-fixed.js del /q main-oauth-fixed.js

echo 🗑️ Deleting development preload files...
if exist preload-simple.js del /q preload-simple.js
if exist preload-fixed.js del /q preload-fixed.js
if exist preload-test.js del /q preload-test.js

echo 🗑️ Deleting test files...
if exist main-test.js del /q main-test.js
if exist test-ipc.bat del /q test-ipc.bat

echo 🗑️ Deleting development HTML files...
if exist src\renderer\index-fixed.html del /q src\renderer\index-fixed.html
if exist src\renderer\test-ipc.html del /q src\renderer\test-ipc.html

echo 🗑️ Deleting development JS files...
if exist src\renderer\js\freeagent-api-working.js del /q src\renderer\js\freeagent-api-working.js
if exist src\renderer\js\freeagent-api-real.js del /q src\renderer\js\freeagent-api-real.js
if exist src\renderer\js\storage-adapter-simple.js del /q src\renderer\js\storage-adapter-simple.js
if exist src\renderer\js\time-tracker.js del /q src\renderer\js\time-tracker.js

echo 🗑️ Deleting temporary files...
if exist SUCCESS.md del /q SUCCESS.md
if exist package-clean.json del /q package-clean.json
if exist temp_main.txt del /q temp_main.txt
if exist CLEANUP-REQUIRED.md del /q CLEANUP-REQUIRED.md
if exist clean-architecture.bat del /q clean-architecture.bat

echo.
echo ✅ CLEANUP COMPLETE!
echo.
echo =======================================
echo  FINAL CLEAN ARCHITECTURE
echo =======================================
echo.
echo Production Files Only:
echo   📄 main.js                    (Main process)
echo   📄 preload.js                 (IPC bridge)
echo   📄 package.json               (Dependencies)
echo   📄 start.bat                  (Single startup script)
echo   📄 README.md                  (Documentation)
echo   📁 src/main/                  (OAuth server)
echo   📁 src/renderer/              (UI and logic)
echo.
echo 🎯 READY FOR PRODUCTION!
echo    No confusion, no clutter.
echo    Future developers will see exactly what matters.
echo.
echo To start the app: start.bat
echo.
pause