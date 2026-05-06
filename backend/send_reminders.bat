@echo off
cd /d "%~dp0"
REM Activate virtual environment if you have one (e.g., call venv\Scripts\activate.bat)
REM call venv\Scripts\activate.bat

python manage.py send_schedule_reminders
