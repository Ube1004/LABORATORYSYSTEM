@echo off

cd /d "%~dp0"

start http://localhost:5000

timeout /t 1 /nobreak >nul

python app.py