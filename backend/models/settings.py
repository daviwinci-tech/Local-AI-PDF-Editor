from pydantic import BaseModel
from typing import Optional

class AppSettings(BaseModel):
    ollama_url: str = "http://localhost:11434"
    model: str = "qwen2.5:latest"
    temperature: float = 0.2
    auto_apply: bool = False
    keep_revision_history: bool = True
    output_directory: str = "./exports"
    ai_engine: str = "ollama"  # ollama | intelligent_rule | gemini
