"""
Ollama API Router.
Endpoints for verifying local Ollama connectivity and fetching available model lists.
"""
from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from backend.ai.ollama_client import OllamaClient
from backend.models.settings import AppSettings

router = APIRouter(prefix="/api/ollama", tags=["Ollama"])
ollama_client = OllamaClient()

@router.get("/status")
async def get_ollama_status():
    status = await ollama_client.get_status()
    return status

@router.get("/models")
async def get_ollama_models():
    models = await ollama_client.list_models()
    return {"models": models}
