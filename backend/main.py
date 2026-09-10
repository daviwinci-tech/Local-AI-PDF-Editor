"""
Main FastAPI Application Entry Point for Local AI PDF Editor.
Binds routers, sets up CORS, static storage mounts, and graceful startup health checks.
"""
import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.api.documents import router as documents_router
from backend.api.ollama import router as ollama_router
from backend.models.settings import AppSettings

app = FastAPI(
    title="Local AI PDF Editor API",
    description="Desktop-class backend for local AI-powered PDF editing, text replacement, and redactions using PyMuPDF and Ollama.",
    version="1.0.0"
)

# Global CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include sub-routers
app.include_router(documents_router)
app.include_router(ollama_router)

# Current runtime settings in-memory
current_settings = AppSettings()

@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "service": "Local AI PDF Editor Backend",
        "version": "1.0.0"
    }

@app.get("/api/settings")
async def get_settings():
    return current_settings

@app.post("/api/settings")
async def update_settings(settings: AppSettings):
    global current_settings
    current_settings = settings
    return {"status": "updated", "settings": current_settings}

if __name__ == "__main__":
    # Run uvicorn on port 8000 when started directly in Python mode
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
