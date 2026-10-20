@echo off
setlocal enabledelayedexpansion

:: ============================================================================
:: SAGE SOA Platform — Master Startup Script
:: ============================================================================
:: This script launches the SAGE microservices architecture in dependency order:
:: 1. Infrastructure: Config Server (:8888) -> Eureka Service Registry (:8761)
:: 2. Backend Services: Auth Service (:8081)
:: 3. Gateway: Spring Cloud API Gateway (:8080)
:: 4. Presentation: SAGE React + Vite Frontend (:8443)
::
:: Notes on placeholder services:
:: calendar-service, notification-service, profile-service, and sage-brain are
:: currently architectural stubs (.gitkeep only) and are not runnable.
:: ============================================================================

set "REPO_ROOT=%~dp0"
if "%REPO_ROOT:~-1%"=="\" set "REPO_ROOT=%REPO_ROOT:~0,-1%"
if not exist "%REPO_ROOT%\logs" mkdir "%REPO_ROOT%\logs"

cls
echo ============================================================================
echo   SAGE Productivity Platform — Starting SOA Microservices
echo ============================================================================
echo   Repository Root: %REPO_ROOT%
echo ============================================================================
echo.

:: ----------------------------------------------------------------------------
:: Step 0: Pre-flight Environment Checks
:: ----------------------------------------------------------------------------
echo [*] Checking environment prerequisites...

where java >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Java 21+ is not found in your PATH. Please install Java and try again.
    pause
    exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not found in your PATH. Please install Node.js and try again.
    pause
    exit /b 1
)

where pnpm >nul 2>&1
if errorlevel 1 (
    echo [WARN] pnpm is not found globally. Falling back to npx pnpm.
    set "PNPM_CMD=npx pnpm"
) else (
    set "PNPM_CMD=pnpm"
)

echo [OK] Java and Node environment verified.
echo.

:: ----------------------------------------------------------------------------
:: Load .env configuration if present
:: ----------------------------------------------------------------------------
if exist "%REPO_ROOT%\.env" (
    echo [*] Loading environment variables from .env...
    for /f "usebackq tokens=1* delims==" %%A in ("%REPO_ROOT%\.env") do (
        set "KEY=%%A"
        set "VAL=%%B"
        if not "!KEY:~0,1!"=="#" if not "!KEY!"=="" (
            set "!KEY!=!VAL!"
        )
    )
    echo [OK] Loaded .env configuration.
    echo.
)

:: ----------------------------------------------------------------------------
:: Step 1: Config Server (Port 8888)
:: ----------------------------------------------------------------------------
echo [1/5] Starting Config Server on port 8888...
if not exist "%REPO_ROOT%\config-server\mvnw.cmd" (
    echo [ERROR] config-server\mvnw.cmd not found. Skipping.
) else (
    start "SAGE - Config Server [8888]" cmd /k "title SAGE - Config Server [8888] && cd /d "%REPO_ROOT%\config-server" && mvnw.cmd spring-boot:run"
    echo     Waiting 10 seconds for Config Server initialization...
    timeout /t 10 /nobreak >nul
)

:: ----------------------------------------------------------------------------
:: Step 2: Eureka Service Registry (Port 8761)
:: ----------------------------------------------------------------------------
echo [2/5] Starting Eureka Service Registry on port 8761...
if not exist "%REPO_ROOT%\eureka-server\mvnw.cmd" (
    echo [ERROR] eureka-server\mvnw.cmd not found. Skipping.
) else (
    start "SAGE - Eureka Server [8761]" cmd /k "title SAGE - Eureka Server [8761] && cd /d "%REPO_ROOT%\eureka-server" && mvnw.cmd spring-boot:run"
    echo     Waiting 12 seconds for Eureka Service Registry to be ready...
    timeout /t 12 /nobreak >nul
)

:: ----------------------------------------------------------------------------
:: Step 3: Auth Service (Port 8081)
:: ----------------------------------------------------------------------------
echo [3/5] Starting Auth Service on port 8081...
if not exist "%REPO_ROOT%\auth-service\mvnw.cmd" (
    echo [ERROR] auth-service\mvnw.cmd not found. Skipping.
) else (
    echo     Note: Ensure PostgreSQL is running on port 5432 [database: authdb].
    start "SAGE - Auth Service [8081]" cmd /k "title SAGE - Auth Service [8081] && cd /d "%REPO_ROOT%\auth-service" && mvnw.cmd spring-boot:run"
    echo     Waiting for Auth Service to be ready on port 8081...
    powershell -NoProfile -Command "$t=35; while ($t -gt 0) { try { $s = New-Object Net.Sockets.TcpClient; $s.Connect('127.0.0.1', 8081); if ($s.Connected) { $s.Close(); break } } catch {} Start-Sleep 1; $t-- }"
)

:: ----------------------------------------------------------------------------
:: Step 4: API Gateway (Port 8080)
:: ----------------------------------------------------------------------------
echo [4/5] Starting Spring Cloud API Gateway on port 8080...
if not exist "%REPO_ROOT%\api-gateway\mvnw.cmd" (
    echo [ERROR] api-gateway\mvnw.cmd not found. Skipping.
) else (
    start "SAGE - API Gateway [8080]" cmd /k "title SAGE - API Gateway [8080] && cd /d "%REPO_ROOT%\api-gateway" && mvnw.cmd spring-boot:run"
    echo     Waiting for API Gateway to be ready on port 8080...
    powershell -NoProfile -Command "$t=20; while ($t -gt 0) { try { $s = New-Object Net.Sockets.TcpClient; $s.Connect('127.0.0.1', 8080); if ($s.Connected) { $s.Close(); break } } catch {} Start-Sleep 1; $t-- }"
)

:: ----------------------------------------------------------------------------
:: Step 5: CURRENT SAGE Frontend (Port 8443)
:: ----------------------------------------------------------------------------
echo [5/5] Starting CURRENT SAGE Frontend [Design SAGE Productivity Platform] on port 8443...
if not exist "%REPO_ROOT%\Design SAGE Productivity Platform\package.json" (
    echo [ERROR] Design SAGE Productivity Platform directory not found. Skipping.
) else (
    start "SAGE - Frontend [8443]" cmd /k "title SAGE - Frontend [8443] && powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%REPO_ROOT%\scripts\Start-FrontendWithLog.ps1" -FrontendPath "%REPO_ROOT%\Design SAGE Productivity Platform" -LogPath "%REPO_ROOT%\logs\frontend.log""
)

echo.
echo ============================================================================
echo   SAGE Platform Startup Complete!
echo ============================================================================
echo.
echo   Service Endpoints:
echo   ------------------
echo   * CURRENT Frontend:    http://localhost:8443/
echo   * API Gateway:         http://localhost:8080/
echo   * Auth Service:        http://localhost:8081/
echo   * Eureka Dashboard:    http://localhost:8761/
echo   * Config Server:       http://localhost:8888/
echo.
echo   * To stop all services cleanly without affecting other apps,
echo     run: stop-soa.bat
echo   * To follow consolidated local logs, run:
echo     powershell -ExecutionPolicy Bypass -File scripts\View-SageLogs.ps1
echo ============================================================================
echo.
pause
