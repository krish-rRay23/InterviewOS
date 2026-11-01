"""
Hybrid & Local Inference Provider for InterviewOS.
Routes to Google Gemini (Cloud Accelerator) when configured,
with seamless, 100% offline fallback to local Ollama (http://127.0.0.1:11434).
Optimized for 4GB VRAM RTX 3050 with keep-alive, context bounds, and token rate tracking.
"""

import time
import json
import logging
import requests
from typing import List, Dict, Any, Optional, Iterator
from local_ai.config.settings import settings

logger = logging.getLogger("interviewos.ai_provider")


class OllamaProvider:
    def __init__(self, base_url: Optional[str] = None):
        self.base_url = base_url or settings.OLLAMA_BASE_URL

    def is_available(self) -> bool:
        """Checks if either Google Gemini or the local Ollama daemon is reachable."""
        if settings.ALLOW_CLOUD_AI and settings.GOOGLE_API_KEY:
            return True
        try:
            resp = requests.get(f"{self.base_url}/api/tags", timeout=1.5)
            return resp.status_code == 200
        except Exception:
            return False

    def is_ollama_available(self) -> bool:
        """Checks if the local Ollama daemon is reachable."""
        try:
            resp = requests.get(f"{self.base_url}/api/tags", timeout=1.5)
            return resp.status_code == 200
        except Exception:
            return False

    def list_models(self) -> List[Dict[str, Any]]:
        """Lists all local models available in Ollama."""
        try:
            resp = requests.get(f"{self.base_url}/api/tags", timeout=2.0)
            if resp.status_code == 200:
                data = resp.json()
                return data.get("models", [])
        except Exception:
            pass
        return []

    def chat(
        self,
        model: str,
        messages: List[Dict[str, str]],
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        num_ctx: Optional[int] = None,
        keep_alive: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Executes a chat completion request.
        Prioritizes Google Gemini when configured, falling back seamlessly
        to local Ollama if offline, rate limited, or on error.
        """
        if settings.ALLOW_CLOUD_AI and settings.GOOGLE_API_KEY:
            try:
                from local_ai.providers.gemini_provider import gemini_provider
                if gemini_provider.is_available():
                    return gemini_provider.chat(
                        messages=messages,
                        temperature=temperature,
                        top_p=top_p
                    )
            except Exception as e:
                logger.info(f"Gemini chat unavailable or failed ({e}); falling back to local Ollama ({model})")

        # Local Ollama Inference (100% Offline Fallback)
        payload = {
            "model": model,
            "messages": messages,
            "stream": False,
            "keep_alive": keep_alive or settings.KEEP_ALIVE,
            "options": {
                "temperature": temperature if temperature is not None else settings.TEMPERATURE,
                "top_p": top_p if top_p is not None else settings.TOP_P,
                "num_ctx": num_ctx if num_ctx is not None else settings.DEFAULT_NUM_CTX
            }
        }

        start_time = time.time()
        resp = requests.post(f"{self.base_url}/api/chat", json=payload, timeout=60.0)
        elapsed = time.time() - start_time

        if resp.status_code != 200:
            raise RuntimeError(f"Ollama chat error ({resp.status_code}): {resp.text}")

        data = resp.json()
        eval_count = data.get("eval_count", 0)
        eval_duration_ns = data.get("eval_duration", 0)
        tokens_per_sec = (eval_count / (eval_duration_ns / 1e9)) if eval_duration_ns > 0 else 0.0

        return {
            "message": data.get("message", {}),
            "content": data.get("message", {}).get("content", ""),
            "model": data.get("model", model),
            "provider": "local-ollama",
            "prompt_eval_count": data.get("prompt_eval_count", 0),
            "eval_count": eval_count,
            "tokens_per_sec": round(tokens_per_sec, 2),
            "elapsed_seconds": round(elapsed, 3),
            "done": data.get("done", True)
        }

    def chat_stream(
        self,
        model: str,
        messages: List[Dict[str, str]],
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        num_ctx: Optional[int] = None,
        keep_alive: Optional[str] = None
    ) -> Iterator[str]:
        """
        Yields chunked SSE strings for streaming chat inference.
        Uses Gemini if available, falling back seamlessly to local Ollama.
        """
        if settings.ALLOW_CLOUD_AI and settings.GOOGLE_API_KEY:
            try:
                from local_ai.providers.gemini_provider import gemini_provider
                if gemini_provider.is_available():
                    for chunk in gemini_provider.chat_stream(
                        messages=messages,
                        temperature=temperature,
                        top_p=top_p
                    ):
                        yield chunk
                    return
            except Exception as e:
                logger.info(f"Gemini streaming unavailable or failed ({e}); falling back to local Ollama ({model})")

        payload = {
            "model": model,
            "messages": messages,
            "stream": True,
            "keep_alive": keep_alive or settings.KEEP_ALIVE,
            "options": {
                "temperature": temperature if temperature is not None else settings.TEMPERATURE,
                "top_p": top_p if top_p is not None else settings.TOP_P,
                "num_ctx": num_ctx if num_ctx is not None else settings.DEFAULT_NUM_CTX
            }
        }

        with requests.post(f"{self.base_url}/api/chat", json=payload, stream=True, timeout=60.0) as resp:
            if resp.status_code != 200:
                raise RuntimeError(f"Ollama stream error ({resp.status_code}): {resp.text}")
            for line in resp.iter_lines():
                if line:
                    chunk = json.loads(line.decode("utf-8"))
                    delta = chunk.get("message", {}).get("content", "")
                    if delta:
                        yield delta


ollama_provider = OllamaProvider()
