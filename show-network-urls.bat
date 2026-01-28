@echo off
echo ================================
echo EHR System - Network Access Info
echo ================================
echo.

REM Get local IP address
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    set IP=%%a
    goto :found
)
:found
set IP=%IP:~1%

echo Your Local Network IP: %IP%
echo.
echo ================================
echo URLs for Testing Team:
echo ================================
echo.
echo Frontend (Next.js):
echo   - Local:   http://localhost:3000
echo   - Network: http://%IP%:3000
echo.
echo Backend (Express API):
echo   - Local:   http://localhost:5000
echo   - Network: http://%IP%:5000
echo.
echo ================================
echo Instructions:
echo ================================
echo 1. Share the Network URLs with your team
echo 2. Make sure they're on the same WiFi/network
echo 3. Check Windows Firewall allows ports 3000 and 5000
echo.
echo To allow ports in firewall (run as Administrator):
echo   netsh advfirewall firewall add rule name="Next.js Dev" dir=in action=allow protocol=TCP localport=3000
echo   netsh advfirewall firewall add rule name="Express API" dir=in action=allow protocol=TCP localport=5000
echo.
pause
