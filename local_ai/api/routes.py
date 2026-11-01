"""
FastAPI Routes for InterviewOS Local AI Service.
Provides REST and streaming endpoints for LLM chat, STT transcription,
TTS synthesis, semantic vector embeddings, and evaluation.
Enforces model allowlists, active health probes, and multilingual voice validation.
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
from local_ai.interview.context_builder import ContextBuilder, InterviewContext, ResumeExtraction
from local_ai.interview.engine import ConversationalEngine
from local_ai.interview.evaluator import ConversationalEvaluator

router = APIRouter()
conversational_engine = ConversationalEngine()


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
    language: Optional[str] = "en"
    voice: Optional[str] = None


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
    installed_models = ollama_provider.list_models() if ollama_ok else []
    piper_ok = piper_provider.is_available()
    vram = gpu_manager.get_vram_info()

    status = "healthy" if (ollama_ok and piper_ok) else "degraded"

    return {
        "status": status,
        "mode": "100% Offline / Local-First",
        "allow_cloud_ai": settings.ALLOW_CLOUD_AI,
        "ollama_available": ollama_ok,
        "installed_ollama_models": installed_models,
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
        "allowed_models": model_router.ALLOWED_MODELS,
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
    Enforces allowlist validation; rejects unapproved models.
    Supports streaming via SSE when req.stream is True.
    """
    try:
        resolved_model = model_router.resolve_model(req.task_type, req.model)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=f"INVALID_MODEL: {str(ve)}")

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
        raise HTTPException(status_code=500, detail=f"LLM_INFERENCE_FAILURE: {str(e)}")


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
        raise HTTPException(status_code=500, detail=f"ASR_PROCESSING_FAILURE: {str(e)}")


@router.post("/synthesize")
def synthesize_speech(req: SynthesizeRequest):
    """
    Synthesizes text into WAV audio using Piper TTS on CPU.
    Validates language availability: returns 422 MULTILINGUAL_VOICE_UNAVAILABLE
    if requested voice is not installed.
    """
    lang = (req.language or "en").lower()
    if lang not in ("en", "en_us", "en-us", "auto"):
        raise HTTPException(
            status_code=422,
            detail=f"MULTILINGUAL_VOICE_UNAVAILABLE: Language '{req.language}' voice model is not installed locally. Currently supported: English (en_US-lessac)."
        )

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
        raise HTTPException(status_code=500, detail=f"TTS_SYNTHESIS_FAILURE: {str(e)}")


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


# --- Conversational Interview Endpoints ---

class InterviewTurnRequest(BaseModel):
    session_id: str
    problem_statement: str
    constraints: Optional[List[str]] = Field(default_factory=list)
    candidate_code: Optional[str] = None
    language: Optional[str] = "python"
    test_results: Optional[Dict[str, Any]] = None
    resume_text: Optional[str] = None
    conversation_summary: Optional[str] = ""
    candidate_utterance: str
    conversation_history: List[Dict[str, str]] = Field(default_factory=list)


class InterviewSummaryRequest(BaseModel):
    session_id: str
    problem_statement: str
    candidate_code: Optional[str] = None
    turns: List[Dict[str, Any]] = Field(default_factory=list)


@router.post("/interview/parse-resume")
async def parse_resume(file: UploadFile = File(...)):
    """Extracts candidate resume text, key skills, and projects locally from PDF, DOCX, or TXT."""
    try:
        content = await file.read()
        res = ContextBuilder.extract_resume_from_bytes(content, file.filename or "resume.pdf")
        return res.model_dump()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"RESUME_EXTRACTION_FAILURE: {str(e)}")


@router.post("/interview/turn")
def process_interview_turn(req: InterviewTurnRequest):
    """
    Continuous conversational AI interview turn processor.
    Extracts concepts, detects language and intent, and generates adaptive follow-up.
    """
    try:
        resume_obj = ResumeExtraction(raw_text=req.resume_text) if req.resume_text else None
        ctx = InterviewContext(
            session_id=req.session_id,
            problem_statement=req.problem_statement,
            constraints=req.constraints or [],
            candidate_code=req.candidate_code,
            language=req.language or "python",
            test_results=req.test_results,
            resume=resume_obj,
            conversation_summary=req.conversation_summary or ""
        )
        result = conversational_engine.process_turn_and_generate_response(
            ctx=ctx,
            candidate_utterance=req.candidate_utterance,
            conversation_history=req.conversation_history
        )
        return {
            "turn_id": result["turn"].turn_id,
            "speaker": "INTERVIEWER",
            "intent": result["intent"],
            "detected_language": result["turn"].detected_language,
            "technical_concepts": result["turn"].technical_concepts,
            "response_text": result["response_text"],
            "action": result["action"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"INTERVIEW_TURN_PROCESSING_FAILURE: {str(e)}")


@router.post("/interview/evaluate")
def evaluate_interview_session(req: InterviewSummaryRequest):
    """
    Generates structured conversational rubric evaluation across 8 dimensions
    grounded in verbatim transcript citations.
    """
    try:
        report = ConversationalEvaluator.evaluate_transcript(
            session_id=req.session_id,
            turns=req.turns,
            problem_statement=req.problem_statement,
            code_submitted=req.candidate_code
        )
        return report.model_dump()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"INTERVIEW_EVALUATION_FAILURE: {str(e)}")

