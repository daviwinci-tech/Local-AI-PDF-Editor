#!/usr/bin/env bash
echo "========================================================"
echo " Starting Local AI PDF Editor"
echo "========================================================"

# Test Ollama
if curl -s http://localhost:11434/api/version > /dev/null 2>&1; then
    echo " [OK] Ollama is connected on http://localhost:11434"
else
    echo " [INFO] Local Ollama not detected at http://localhost:11434."
    echo " [INFO] You can run 'ollama serve' in another terminal."
fi

# Run backend in background if venv exists
if [ -d "venv" ]; then
    echo " Starting Python FastAPI backend on port 8000..."
    source venv/bin/activate
    python3 -m uvicorn backend.main:app --port 8000 &
    BACKEND_PID=$!
    trap "kill $BACKEND_PID 2> /dev/null" EXIT
fi

# Start Frontend dev server
echo " Starting Web Frontend & API server on port 3000..."
npm run dev
