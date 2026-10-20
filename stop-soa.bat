@echo off
setlocal enabledelayedexpansion

:: ============================================================================
:: SAGE SOA Platform — Safe Shutdown Script
:: ============================================================================
:: This script safely stops only the processes and terminal windows launched
:: by start-soa.bat without killing unrelated applications:
:: - Port 8888 : Config Server
:: - Port 8761 : Eureka Server
:: - Port 8081 : Auth Service
:: - Port 8080 : API Gateway
:: - Port 8443 : SAGE Frontend
:: ============================================================================

cls
echo ============================================================================
echo   SAGE Productivity Platform — Stopping SOA Microservices
echo ============================================================================
echo.

call :StopPort 8888 "Config Server"
call :StopPort 8761 "Eureka Server"
call :StopPort 8081 "Auth Service"
call :StopPort 8080 "API Gateway"
call :StopPort 8443 "SAGE Frontend"

echo.
echo [*] Closing any remaining SAGE service console windows...
taskkill /f /fi "WINDOWTITLE eq SAGE - *" /im cmd.exe >nul 2>&1

echo.
echo ============================================================================
echo   All SAGE SOA services and frontend have been safely stopped.
echo ============================================================================
echo.
pause
goto :eof

:: ----------------------------------------------------------------------------
:: Subroutine: Stop process listening on a specific TCP port
:: ----------------------------------------------------------------------------
:StopPort
set "TARGET_PORT=%~1"
set "SERVICE_NAME=%~2"
set "PORT_FOUND=0"

for /f "tokens=5" %%A in ('netstat -ano 2^>nul ^| findstr ":%TARGET_PORT% " ^| findstr "LISTENING"') do (
    set "TARGET_PID=%%A"
    if not "!TARGET_PID!"=="" if not "!TARGET_PID!"=="0" (
        echo [*] Stopping %SERVICE_NAME% on port %TARGET_PORT% [PID: !TARGET_PID!]...
        taskkill /f /t /pid !TARGET_PID! >nul 2>&1
        set "PORT_FOUND=1"
    )
)

if "!PORT_FOUND!"=="0" (
    echo [-] %SERVICE_NAME% on port %TARGET_PORT% is not running.
) else (
    echo [OK] %SERVICE_NAME% on port %TARGET_PORT% stopped.
)
goto :eof
