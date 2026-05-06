@echo off
cd /d "c:\VSCODE\PROJECTS\PrepArena2\PrepArena\backend"

REM Use the virtual environment python to run the command
"venv\Scripts\python.exe" manage.py send_schedule_reminders
