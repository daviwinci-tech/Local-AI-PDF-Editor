"""
Ollama Local API Client.
Interfaces with local Ollama server instance (default http://localhost:11434).
Supports listing downloaded models, checking connectivity status, and streaming or JSON completions.
"""
import json
from typing import List, Dict, Any, Optional
import httpx

class OllamaClient:
    def __init__(self, base_url: str = "http://localhost:11434"):
        self.base_url = base_url.rstrip("/")

    async def get_status(self) -> Dict[str, Any]:
        """Check if local Ollama server is running and reachable."""
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.get(f"{self.base_url}/api/version")
                if res.status_code == 200:
                    data = res.json()
                    return {
                        "online": True,
                        "version": data.get("version", "unknown"),
                        "url": self.base_url
                    }
        except Exception as e:
            pass
        return {
            "online": False,
            "version": None,
            "url": self.base_url,
            "error": "Ollama není dostupná. Ujistěte se, že služba Ollama běží (např. 'ollama serve')."
        }

    async def list_models(self) -> List[Dict[str, Any]]:
        """List locally available models in Ollama."""
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.get(f"{self.base_url}/api/tags")
                if res.status_code == 200:
                    data = res.json()
                    models = []
                    for m in data.get("models", []):
                        models.append({
                            "name": m.get("name"),
                            "size": m.get("size", 0),
                            "modified_at": m.get("modified_at", ""),
                            "family": m.get("details", {}).get("family", "")
                        })
                    return models
        except Exception:
            pass
        return []

    async def generate_completion(self, model: str, prompt: str, system: Optional[str] = None,
                                  temperature: float = 0.2, format_json: bool = True) -> str:
        """Call Ollama /api/generate with JSON schema formatting."""
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature
            }
        }
        if system:
            payload["system"] = system
        if format_json:
            payload["format"] = "json"

        async with httpx.AsyncClient(timeout=45.0) as client:
            res = await client.post(f"{self.base_url}/api/generate", json=payload)
            if res.status_code != 200:
                raise RuntimeError(f"Ollama API returned error {res.status_code}: {res.text}")
            data = res.json()
            return data.get("response", "")
