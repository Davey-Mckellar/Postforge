@echo off
title bbGPT — Build + Deploy
cd /d C:\Users\mckel\postforge

echo.
echo =========================================
echo  Step 1: DB migrate
echo =========================================
call npm run db:migrate
if %ERRORLEVEL% NEQ 0 (
  echo [WARN] Migration had issues — continuing to build anyway.
)

echo.
echo =========================================
echo  Step 2: Build
echo =========================================
call npm run build
if %ERRORLEVEL% NEQ 0 (
  echo [FAILED] Build failed — see errors above.
  pause
  exit /b 1
)

echo.
echo =========================================
echo  Step 3: Deploy to Vercel production
echo =========================================
call npm run deploy:prod
if %ERRORLEVEL% NEQ 0 (
  echo [FAILED] Deploy failed.
  pause
  exit /b 1
)

echo.
echo =========================================
echo  DONE — live at https://www.bbgpt.ai
echo =========================================
pause
