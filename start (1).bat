@echo off
echo Starting GradeCalculator...

:: Start Backend
start "Backend" cmd /k "cd /d C:\Users\marce\PersonalProjects\GradeCalculator (1)\GradeCalculator\backend\GradeCalculator.API && dotnet run"

:: Wait a moment for backend to start
timeout /t 3 /nobreak >nul

:: Start Frontend
start "Frontend" cmd /k "cd /d C:\Users\marce\PersonalProjects\GradeCalculator (1)\GradeCalculator\frontend && python -m http.server 3000"

:: Wait a moment then open browser
timeout /t 2 /nobreak >nul
start http://localhost:3000

echo.
echo Both servers starting...
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000
echo.
