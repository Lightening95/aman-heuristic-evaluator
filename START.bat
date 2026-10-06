@echo off
title Dashboard Heuristic Evaluator
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto nonode

if exist .env.local goto haveenv
echo.
echo First-time setup.
echo Get a free key at https://aistudio.google.com/apikey (opening it now).
start "" https://aistudio.google.com/apikey
echo.
set /p KEY=Paste your Gemini API key here and press Enter:
> .env.local echo GEMINI_API_KEY=%KEY%
echo Key saved.

:haveenv
if exist node_modules goto run
echo.
echo Installing (first time only, takes a few minutes)...
call npm install
if errorlevel 1 goto failed

:run
echo.
echo Starting. Your browser will open in a few seconds.
echo Keep this window open while you use the evaluator. Close it to stop.
start "" cmd /c "timeout /t 8 >nul & start http://localhost:3000"
call npm run dev
goto end

:nonode
echo.
echo Node.js is not installed. Opening the download page.
echo Install the LTS version, then double-click START.bat again.
start "" https://nodejs.org/en/download
pause
goto end

:failed
echo.
echo Installation failed. Take a screenshot of this window and send it to Claude.
pause

:end

