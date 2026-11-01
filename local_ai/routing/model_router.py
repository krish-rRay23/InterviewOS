"""
Model Routing Engine.
Routes incoming inference requests to the optimal local model based on task category,
context length, and RTX 3050 hardware efficiency profiles.
Enforces strict allowlist validation; rejects unapproved or cloud model requests.
"""

from typing import Optional, List
from local_ai.config.settings import settings


class ModelRouter:
    # Strictly approved offline-first local models
    ALLOWED_MODELS: List[str] = [
        settings.PRIMARY_CODING_MODEL,
        settings.FAST_MODEL,
        settings.REASONING_MODEL,
        settings.OFFLOADED_MODEL,
        settings.EMBEDDING_MODEL,
    ]

    TASK_MAPPING = {
        # Coding tasks -> primary fast coder 3B
        "code_generation": settings.PRIMARY_CODING_MODEL,
        "code_review": settings.PRIMARY_CODING_MODEL,
        "code_explain": settings.PRIMARY_CODING_MODEL,
        "syntax_analysis": settings.PRIMARY_CODING_MODEL,
        "test_generation": settings.PRIMARY_CODING_MODEL,

        # Lightweight extraction & classification -> 1.5B (low latency, high tokens/sec)
        "intent": settings.FAST_MODEL,
        "classification": settings.FAST_MODEL,
        "tagging": settings.FAST_MODEL,
        "extraction": settings.FAST_MODEL,
        "short_summary": settings.FAST_MODEL,

        # Deep reasoning & investigation -> Granite 3B
        "investigation_hypothesis": settings.REASONING_MODEL,
        "investigation_reasoning": settings.REASONING_MODEL,
        "rubric_evaluation": settings.REASONING_MODEL,
        "interview_followup": settings.REASONING_MODEL,
        "general_reasoning": settings.REASONING_MODEL,

        # Large context or multi-file reasoning -> 7B
        "complex_architecture": settings.OFFLOADED_MODEL,
        "large_refactoring": settings.OFFLOADED_MODEL,
    }

    @classmethod
    def resolve_model(cls, task_type: Optional[str] = None, requested_model: Optional[str] = None) -> str:
        """
        Resolves which local Ollama model to invoke.
        Priority:
        1. Explicit requested_model (if provided, MUST match allowlist)
        2. Task-specific mapping
        3. Default to PRIMARY_CODING_MODEL

        Raises ValueError if requested_model is not in ALLOWED_MODELS.
        """
        if requested_model:
            # Check strict allowlist match (exact or substring like 'qwen2.5-coder:3b')
            clean_req = requested_model.strip().lower()
            for allowed in cls.ALLOWED_MODELS:
                if clean_req == allowed.lower() or clean_req == allowed.lower().split(":")[0]:
                    return allowed

            raise ValueError(
                f"Model '{requested_model}' is not permitted in local-first allowlist. "
                f"Allowed models: {cls.ALLOWED_MODELS}"
            )

        if task_type and task_type in cls.TASK_MAPPING:
            return cls.TASK_MAPPING[task_type]

        return settings.PRIMARY_CODING_MODEL


model_router = ModelRouter()
