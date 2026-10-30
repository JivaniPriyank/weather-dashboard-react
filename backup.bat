@echo off
REM Saves all your changes to Git and uploads them to GitHub.
REM Double-click this file whenever you want a backup.
REM Optional: run it as   backup.bat Your message here   to choose the message yourself.
cd /d "%~dp0"

where git >nul 2>nul
if errorlevel 1 (
  echo Git is not installed or not found. Install it from https://git-scm.com
  pause
  exit /b 1
)

if exist ".git\index.lock" (
  echo Git is busy: another save is still open, for example in VS Code.
  echo Finish or close it there first, then run this again.
  pause
  exit /b 1
)

set "MSG=%*"
if not "%MSG%"=="" goto have_message
for /f "delims=" %%i in ('powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd HH:mm'"') do set "MSG=Backup %%i"
:have_message

echo.
echo Saving your changes...
git add -A
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "%MSG%"
  if errorlevel 1 (
    echo The save did not work. Read the message above, or ask Claude.
    pause
    exit /b 1
  )
) else (
  echo Nothing new to save since the last backup.
)

echo.
echo Uploading to GitHub...
git push
if errorlevel 1 (
  echo.
  echo The upload did not work. Your changes ARE saved on this computer.
  echo Check your internet connection or GitHub sign-in, then run this again.
  pause
  exit /b 1
)

echo.
echo Done. Your work is saved on this computer and on GitHub.
pause
