"""
Google Gemini Cloud Provider for InterviewOS.
High-throughput, low-latency LLM accelerator with seamless offline fallback to Ollama.
"""

import time
import json
import logging
import urllib.request
import urllib.error
from typing import List, Dict, Any, Optional, Iterator

from local_ai.config.settings import settings

logger = logging.getLogger("interviewos.gemini")


class GeminiProvider:
    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or settings.GOOGLE_API_KEY
        self.model = model or getattr(settings, "GEMINI_MODEL", "gemini-2.5-flash-lite")
        self.base_url = "https://generativelanguage.googleapis.com/v1beta/models"

    def is_available(self) -> bool:
        """Verifies if an API key is configured and cloud AI is enabled."""
        return bool(self.api_key and settings.ALLOW_CLOUD_AI)

    def _convert_messages(self, messages: List[Dict[str, str]]) -> tuple[Optional[Dict[str, Any]], List[Dict[str, Any]]]:
        """Converts OpenAI/Ollama messages into Gemini contents and systemInstruction."""
        system_instruction = None
        contents: List[Dict[str, Any]] = []

        for m in messages:
            role = m.get("role", "user")
            content = m.get("content", "")
            if not content.strip():
                continue

            if role == "system":
                system_instruction = {"parts": [{"text": content}]}
            elif role == "assistant":
                contents.append({"role": "model", "parts": [{"text": content}]})
            else:
                contents.append({"role": "user", "parts": [{"text": content}]})

        # Ensure at least one user turn exists
        if not contents:
            contents.append({"role": "user", "parts": [{"text": "Hello"}]})

        return system_instruction, contents

    def chat(
        self,
        messages: List[Dict[str, str]],
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        max_output_tokens: int = 1500,
        timeout: float = 12.0
    ) -> Dict[str, Any]:
        """
        Executes a synchronous completion via Google Gemini REST API.
        """
        if not self.is_available():
            raise RuntimeError("Gemini provider is not available or ALLOW_CLOUD_AI is disabled")

        system_instruction, contents = self._convert_messages(messages)
        payload: Dict[str, Any] = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature if temperature is not None else settings.TEMPERATURE,
                "topP": top_p if top_p is not None else settings.TOP_P,
                "maxOutputTokens": max_output_tokens
            }
        }
        if system_instruction:
            payload["systemInstruction"] = system_instruction

        url = f"{self.base_url}/{self.model}:generateContent"
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": self.api_key
            }
        )

        start_time = time.time()
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as he:
            err_body = he.read().decode("utf-8", errors="replace")
            logger.warning(f"Gemini API HTTP Error {he.code}: {err_body[:200]}")
            raise RuntimeError(f"Gemini API returned status {he.code}: {err_body[:200]}") from he
        except Exception as e:
            logger.warning(f"Gemini API call failed: {e}")
            raise RuntimeError(f"Gemini API request failed: {e}") from e

        elapsed = time.time() - start_time
        candidates = data.get("candidates", [])
        if not candidates:
            raise RuntimeError("Gemini returned empty candidate response")

        text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        eval_count = len(text.split())
        tokens_per_sec = (eval_count / max(0.001, elapsed))

        return {
            "message": {"role": "assistant", "content": text},
            "content": text,
            "model": self.model,
            "provider": "google-gemini",
            "eval_count": eval_count,
            "tokens_per_sec": round(tokens_per_sec, 2),
            "elapsed_seconds": round(elapsed, 3),
            "done": True
        }

    def chat_stream(
        self,
        messages: List[Dict[str, str]],
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        max_output_tokens: int = 1500,
        timeout: float = 15.0
    ) -> Iterator[str]:
        """
        Streams server-sent events (SSE) chunks from Gemini API.
        """
        if not self.is_available():
            raise RuntimeError("Gemini provider is not available or ALLOW_CLOUD_AI is disabled")

        system_instruction, contents = self._convert_messages(messages)
        payload: Dict[str, Any] = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature if temperature is not None else settings.TEMPERATURE,
                "topP": top_p if top_p is not None else settings.TOP_P,
                "maxOutputTokens": max_output_tokens
            }
        }
        if system_instruction:
            payload["systemInstruction"] = system_instruction

        url = f"{self.base_url}/{self.model}:streamGenerateContent?alt=sse"
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": self.api_key
            }
        )

        with urllib.request.urlopen(req, timeout=timeout) as resp:
            for line in resp:
                line_str = line.decode("utf-8", errors="replace").strip()
                if line_str.startswith("data: "):
                    try:
                        chunk_json = json.loads(line_str[6:])
                        part_text = chunk_json["candidates"][0]["content"]["parts"][0]["text"]
                        yield part_text
                    except Exception:
                        continue


gemini_provider = GeminiProvider()

