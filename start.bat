@echo off
setlocal

REM Starts both halves of the app for local development.
REM   Backend  -> http://localhost:5000  (ASP.NET Core, reads appsettings.Development.json)
REM   Frontend -> http://localhost:5173  (Vite dev server, proxies /api to the backend)

echo Starting CalcYourGPA...
echo.

if not exist "%~dp0backend\GradeCalculator.API\appsettings.Development.json" (
    echo [!] backend\GradeCalculator.API\appsettings.Development.json is missing.
    echo     The backend needs a local MySQL connection string to start.
    echo     See README.md, "Running locally".
    echo.
    pause
    exit /b 1
)

if not exist "%~dp0frontend\node_modules" (
    echo Installing frontend dependencies ^(first run only^)...
    pushd "%~dp0frontend"
    call npm install
    popd
    echo.
)

start "CalcYourGPA API" cmd /k "cd /d "%~dp0backend\GradeCalculator.API" && dotnet run"

REM Give the API a moment so the frontend's first request does not race the migration step.
timeout /t 4 /nobreak >nul

start "CalcYourGPA Web" cmd /k "cd /d "%~dp0frontend" && npm run dev"

timeout /t 3 /nobreak >nul
start http://localhost:5173

echo.
echo Backend:  http://localhost:5000  ^(Swagger at /swagger^)
echo Frontend: http://localhost:5173
echo.
endlocal
