@echo off
REM One-time setup on Windows (React version). Double-click, or run in a terminal.
cd /d "%~dp0"
echo.
echo === The German Lab (React version): first-time setup ===
where py >nul 2>nul
if errorlevel 1 (
  echo Python is not installed. Get it from https://www.python.org/downloads/ and tick "Add python.exe to PATH".
  pause
  exit /b 1
)
if not exist .venv (
  py -m venv .venv || goto :fail
)
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip >nul
pip install -r requirements.txt || goto :fail
if not exist .env copy .env.example .env >nul
python manage.py migrate || goto :fail
python manage.py seed_content || goto :fail
echo.
echo Now create YOUR teacher account:
python manage.py createteacher || goto :fail
echo.
echo Setup finished. Double-click run.bat to start the website.
pause
exit /b 0
:fail
echo.
echo Something went wrong above. Copy the red text and ask for help.
pause
exit /b 1
