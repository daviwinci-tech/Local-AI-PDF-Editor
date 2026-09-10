@echo off
echo ========================================================
echo  Local AI PDF Editor - Setup Script (Windows)
echo ========================================================

echo [1/3] Creating Python Virtual Environment (venv)...
python -m venv venv
if %errorlevel% neq 0 (
    echo Error: Failed to create virtual environment. Make sure Python 3.10+ is installed.
    pause
    exit /b %errorlevel%
)

echo [2/3] Installing Python Dependencies from requirements.txt...
call venv\Scripts\activate.bat
pip install --upgrade pip
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo Error: Failed to install Python dependencies.
    pause
    exit /b %errorlevel%
)

echo [3/3] Installing Frontend NPM Dependencies...
call npm install
if %errorlevel% neq 0 (
    echo Error: Failed to install NPM dependencies.
    pause
    exit /b %errorlevel%
)

echo ========================================================
echo  Setup Completed Successfully!
echo  Run start.bat to launch the application.
echo ========================================================
pause
