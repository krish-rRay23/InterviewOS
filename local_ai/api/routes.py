"""
FastAPI Routes for InterviewOS Local AI Service.
Provides REST and streaming endpoints for LLM chat, STT transcription,
TTS synthesis, semantic vector embeddings, and evaluation.
"""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from local_ai.config.settings import settings
from local_ai.routing.model_router import model_router
from local_ai.routing.gpu_resource_manager import gpu_manager
from local_ai.providers.ollama_provider import ollama_provider
from local_ai.providers.nomic_embedding_provider import nomic_embedding_provider
from local_ai.providers.faster_whisper_provider import faster_whisper_provider
from local_ai.providers.piper_provider import piper_provider

router = APIRouter()


# --- Request & Response Models ---

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    task_type: Optional[str] = "code_generation"
    model: Optional[str] = None
    temperature: Optional[float] = None
    top_p: Optional[float] = None
    num_ctx: Optional[int] = None
    stream: bool = False


class EmbedRequest(BaseModel):
    texts: List[str]
    task_type: Optional[str] = "document"  # "document" or "query"


class SynthesizeRequest(BaseModel):
    text: str


class EvaluateRequest(BaseModel):
    candidate_code: str
    problem_description: str
    test_results: Optional[Dict[str, Any]] = None
    concepts: Optional[List[str]] = None


# --- Endpoints ---

@router.get("/health")
def health_check():
    """Returns operational health of all local AI engines and GPU hardware."""
    ollama_ok = ollama_provider.is_available()
    piper_ok = piper_provider.is_available()
    vram = gpu_manager.get_vram_info()

    return {
        "status": "healthy" if ollama_ok else "degraded",
        "mode": "100% Offline / Local-First",
        "allow_cloud_ai": settings.ALLOW_CLOUD_AI,
        "ollama_available": ollama_ok,
        "piper_tts_available": piper_ok,
        "whisper_stt_available": True,
        "gpu_vram": vram
    }


@router.get("/models")
def list_models():
    """Lists installed local models and currently resident models in VRAM."""
    available = ollama_provider.list_models()
    loaded = gpu_manager.get_loaded_ollama_models()
    return {
        "available_models": available,
        "loaded_in_vram": loaded,
        "active_routing_rules": model_router.TASK_MAPPING
    }


@router.get("/metrics")
def get_metrics():
    """Telemetry endpoint returning GPU VRAM, temperature, power, and model memory."""
    vram = gpu_manager.get_vram_info()
    loaded = gpu_manager.get_loaded_ollama_models()
    return {
        "hardware": vram,
        "loaded_models": loaded,
        "vram_limit_mb": 4096.0
    }


@router.post("/chat")
def chat_completion(req: ChatRequest):
    """
    Executes a chat completion with intelligent model routing.
    Supports streaming via SSE when req.stream is True.
    """
    resolved_model = model_router.resolve_model(req.task_type, req.model)
    raw_messages = [{"role": m.role, "content": m.content} for m in req.messages]

    if req.stream:
        def event_generator():
            for chunk in ollama_provider.chat_stream(
                model=resolved_model,
                messages=raw_messages,
                temperature=req.temperature,
                top_p=req.top_p,
                num_ctx=req.num_ctx
            ):
                yield f"data: {chunk}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(event_generator(), media_type="text/event-stream")

    try:
        result = ollama_provider.chat(
            model=resolved_model,
            messages=raw_messages,
            temperature=req.temperature,
            top_p=req.top_p,
            num_ctx=req.num_ctx
        )
        return {
            "model_used": resolved_model,
            "task_type": req.task_type,
            "response": result["content"],
            "tokens_per_sec": result["tokens_per_sec"],
            "eval_count": result["eval_count"],
            "elapsed_seconds": result["elapsed_seconds"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    language: Optional[str] = Form("auto")
):
    """
    Transcribes uploaded audio file (WAV/MP3/WebM/OGG) using Faster-Whisper on CPU.
    """
    try:
        content = await file.read()
        res = faster_whisper_provider.transcribe(content, language_hint=language)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


@router.post("/synthesize")
def synthesize_speech(req: SynthesizeRequest):
    """
    Synthesizes text into WAV audio using Piper TTS on CPU.
    Returns audio/wav bytes stream.
    """
    try:
        res = piper_provider.synthesize(req.text)
        return Response(
            content=res["audio_bytes"],
            media_type="audio/wav",
            headers={
                "X-Sample-Rate": str(res["sample_rate"]),
                "X-Duration-Seconds": str(res["duration_seconds"]),
                "X-Latency-Seconds": str(res["latency_seconds"]),
                "Content-Disposition": "inline; filename=speech.wav"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Synthesis failed: {str(e)}")


@router.post("/embed")
def generate_embeddings(req: EmbedRequest):
    """
    Generates 768-dimensional dense vector embeddings with Nomic Embed Text.
    """
    try:
        embeddings = nomic_embedding_provider.embed(req.texts, task_type=req.task_type or "document")
        return {
            "model": settings.EMBEDDING_MODEL,
            "dimensions": len(embeddings[0]) if embeddings else 768,
            "count": len(embeddings),
            "embeddings": embeddings
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding generation failed: {str(e)}")


@router.post("/evaluate")
def evaluate_assessment(req: EvaluateRequest):
    """
    Structured rubric scoring and assessment code evaluation using local Granite/Qwen model.
    """
    resolved_model = model_router.resolve_model("rubric_evaluation")

    system_prompt = (
        "You are an expert technical interviewer and code reviewer. "
        "Analyze the candidate's code against the problem statement and test results. "
        "Return a concise technical assessment explaining algorithmic complexity, correctness, and rubric score."
    )

    user_prompt = (
        f"Problem Statement:\n{req.problem_description}\n\n"
        f"Candidate Implementation:\n```\n{req.candidate_code}\n```\n\n"
        f"Test Results: {req.test_results or 'All tests passing'}\n"
        f"Target Concepts: {', '.join(req.concepts or [])}\n"
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

    try:
        result = ollama_provider.chat(
            model=resolved_model,
            messages=messages,
            temperature=0.1
        )
        return {
            "model_used": resolved_model,
            "evaluation": result["content"],
            "tokens_per_sec": result["tokens_per_sec"],
            "elapsed_seconds": result["elapsed_seconds"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Evaluation failed: {str(e)}")
