@echo off
REM Starts the website (React version). Keep this window open while you use it.
cd /d "%~dp0"
if not exist .venv (
  echo Run setup.bat first.
  pause
  exit /b 1
)
call .venv\Scripts\activate.bat
python manage.py migrate --noinput >nul
echo.
echo The German Lab is running. Open http://127.0.0.1:8000 in your browser.
echo Password-reset links are printed in this window. Press Ctrl+C to stop.
echo.
start "" http://127.0.0.1:8000
python manage.py runserver 127.0.0.1:8000
