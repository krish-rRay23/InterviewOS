"""
Local AI Configuration and Settings.
Enforces offline-first operation, strictly forbids cloud AI fallbacks,
and configures model routing tailored for the HP Victus RTX 3050 (4GB VRAM).
"""

import os
from typing import Dict, Any
from pydantic import BaseModel
from dotenv import load_dotenv

# Enforce loading of root .env configuration
load_dotenv()


class LocalAISettings(BaseModel):
    # Operating mode
    OFFLINE_MODE: bool = True
    ALLOW_CLOUD_AI: bool = False

    # Server endpoints
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    OLLAMA_BASE_URL: str = os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434")

    # Local LLMs (Reusing existing installed Ollama models)
    PRIMARY_CODING_MODEL: str = "qwen2.5-coder:3b"
    FAST_MODEL: str = "qwen2.5-coder:1.5b"
    REASONING_MODEL: str = "granite4.1:3b"
    OFFLOADED_MODEL: str = "qwen2.5-coder:7b-instruct-q4_K_M"
    EMBEDDING_MODEL: str = "nomic-embed-text:latest"

    # Context window & generation parameters for RTX 3050 4GB VRAM
    DEFAULT_NUM_CTX: int = 2048
    MAX_NUM_CTX: int = 4096
    KEEP_ALIVE: str = "5m"
    TEMPERATURE: float = 0.2
    TOP_P: float = 0.9

    # Faster Whisper settings (CPU INT8 to prevent GPU VRAM exhaustion)
    WHISPER_MODEL_NAME: str = "tiny"  # Or "base"
    WHISPER_DEVICE: str = "cpu"
    WHISPER_COMPUTE_TYPE: str = "int8"
    WHISPER_BEAM_SIZE: int = 1

    # Piper TTS settings (CPU ONNX)
    PIPER_MODEL_PATH: str = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        "models",
        "piper",
        "en_US-lessac-medium.onnx"
    )
    PIPER_CONFIG_PATH: str = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        "models",
        "piper",
        "en_US-lessac-medium.onnx.json"
    )


settings = LocalAISettings()
