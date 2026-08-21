@echo off
title Deploy Campus Gate Pass to 24/7 Cloud
echo ========================================================
echo   CAMPUS GATE PASS - AUTOMATIC 24/7 CLOUD DEPLOYMENT
echo ========================================================
echo.
echo This script will push your application to GitHub so it runs
echo 24/7 permanently on the cloud without needing your laptop!
echo.
set /p REPO_URL="Enter your GitHub Repository URL (e.g. https://github.com/username/campus-gate-pass.git): "

if "%REPO_URL%"=="" (
    echo Error: No repository URL provided.
    pause
    exit /b
)

echo.
echo [1/3] Adding Git Remote...
git remote remove origin >nul 2>&1
git remote add origin %REPO_URL%

echo [2/3] Preparing Branches and Committing...
git branch -M main
git add .
git commit -m "Deploy 24/7 Standalone Gate Pass App" >nul 2>&1

echo [3/3] Pushing to GitHub...
git push -u origin main

echo.
echo ========================================================
echo   CODE SUCCESSFULLY PUSHED TO GITHUB!
echo ========================================================
echo.
echo Final 1-Click Step to get your permanent link:
echo 1. Open: https://dashboard.render.com
echo 2. Click "New +" -> "Web Service" -> Connect your repository
echo 3. Click "Create Web Service"
echo.
echo Render will automatically deploy your 24/7 Permanent Global URL!
echo ========================================================
pause
