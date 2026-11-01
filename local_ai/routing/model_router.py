"""
Model Routing Engine.
Routes incoming inference requests to the optimal local model based on task category,
context length, and RTX 3050 hardware efficiency profiles.
"""

from typing import Optional
from local_ai.config.settings import settings

class ModelRouter:
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
        1. Explicit requested_model (if provided and valid)
        2. Task-specific mapping
        3. Default to PRIMARY_CODING_MODEL
        """
        if requested_model:
            # Enforce local models only
            valid_locals = [
                settings.PRIMARY_CODING_MODEL,
                settings.FAST_MODEL,
                settings.REASONING_MODEL,
                settings.OFFLOADED_MODEL,
                settings.EMBEDDING_MODEL,
            ]
            for valid in valid_locals:
                if requested_model.lower() in valid.lower():
                    return valid
            return requested_model

        if task_type and task_type in cls.TASK_MAPPING:
            return cls.TASK_MAPPING[task_type]

        return settings.PRIMARY_CODING_MODEL


model_router = ModelRouter()
