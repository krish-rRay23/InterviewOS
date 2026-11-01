"""
InterviewOS Local AI Service Entry Point.
Runs on http://127.0.0.1:8000.
Integrates Ollama LLMs, Nomic Embeddings, Faster-Whisper STT, and Piper TTS.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from local_ai.config.settings import settings
from local_ai.api.routes import router
from local_ai.providers.ollama_provider import ollama_provider
from local_ai.routing.gpu_resource_manager import gpu_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("=" * 60)
    print(" INTERVIEWOS LOCAL AI SERVICE STARTING")
    print(" Mode: 100% Offline / Local-First")
    print(f" Ollama URL: {settings.OLLAMA_BASE_URL}")
    print(f" Cloud AI Allowed: {settings.ALLOW_CLOUD_AI}")
    print(f" Primary Coder: {settings.PRIMARY_CODING_MODEL}")
    print(f" Reasoning Engine: {settings.REASONING_MODEL}")
    print(f" Embedding Engine: {settings.EMBEDDING_MODEL}")
    vram = gpu_manager.get_vram_info()
    print(f" Hardware: {vram.get('device_name')}")
    print(f" Dedicated VRAM: {vram.get('total_mb')} MB (Used: {vram.get('used_mb')} MB)")

    # Warm up CPU speech engines in background to eliminate first-request latency
    try:
        from local_ai.providers.piper_provider import piper_provider
        piper_provider._ensure_loaded()
        print(" [OK] Piper TTS Voice preloaded into CPU memory.")
    except Exception as e:
        print(f" [WARN] Piper preload: {e}")

    print("=" * 60)
    yield
    print("INTERVIEWOS LOCAL AI SERVICE SHUTDOWN COMPLETE")


app = FastAPI(
    title="InterviewOS Local AI Service",
    description="Offline-First AI Inference, Speech, and Evaluation Engine for Technical Assessments",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="")


if __name__ == "__main__":
    uvicorn.run(
        "local_ai.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=False,
        log_level="info"
    )
