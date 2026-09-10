@echo off
echo ========================================================
echo  Starting Local AI PDF Editor (Full-Stack Mode)
echo ========================================================

:: Check if Ollama is running
echo Checking Ollama connectivity...
curl -s http://localhost:11434/api/version > nul
if %errorlevel% neq 0 (
    echo [INFO] Local Ollama not detected at http://localhost:11434.
    echo [INFO] You can still use the app with built-in rule parser or start Ollama separately with: ollama serve
) else (
    echo [OK] Ollama is active!
)

:: Start Backend in Background or new window
echo Starting Python FastAPI backend on port 8000...
start "PDF Editor Backend" cmd /k "venv\Scripts\activate.bat && python -m uvicorn backend.main:app --port 8000 --reload"

:: Start Frontend dev server
echo Starting Frontend React/Vite server on port 3000...
npm run dev
