@echo off
start cmd /k "cd backend\GradeCalculator.API && dotnet run"
start cmd /k "cd frontend && python -m http.server 3000"
timeout /t 3
start http://localhost:3000