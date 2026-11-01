"""
Pluggable LLM Provider Adapters (Section 4 & Section 9).
100% Offline / Local-First AI Architecture for InterviewOS.
Routes to the InterviewOS Local AI Service (FastAPI on localhost:8000)
or directly to local Ollama (http://127.0.0.1:11434).
Zero external/cloud API calls.
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional
import os
import json
import urllib.request
import urllib.error


class LLMProviderInterface(ABC):
    @abstractmethod
    def generate_hypothesis(self, anomaly_event: Dict[str, Any], context_events: List[Dict[str, Any]]) -> str:
        pass

    @abstractmethod
    def generate_interview_followup(self, transcript: str, concepts: List[str], lang: str) -> str:
        pass

    @abstractmethod
    def generate_rubric_explanation(self, test_results: Dict[str, Any], concepts: List[str]) -> str:
        pass


class LocalAIProvider(LLMProviderInterface):
    """
    Production-grade local AI provider.
    Communicates with InterviewOS Local AI Service (port 8000) or direct Ollama (port 11434).
    Uses granite4.1:3b for reasoning and qwen2.5-coder:3b for technical evaluation.
    """
    def __init__(self, service_url: str = "http://127.0.0.1:8000", ollama_url: str = "http://127.0.0.1:11434"):
        self.service_url = service_url
        self.ollama_url = ollama_url

    def _call_service(self, task_type: str, messages: List[Dict[str, str]]) -> Optional[str]:
        """Calls the InterviewOS Local AI FastAPI service."""
        payload = {
            "task_type": task_type,
            "messages": messages,
            "temperature": 0.2
        }
        req = urllib.request.Request(
            f"{self.service_url}/chat",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        try:
            with urllib.request.urlopen(req, timeout=15.0) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return data.get("response", "").strip()
        except Exception:
            return None

    def _call_ollama_direct(self, model: str, messages: List[Dict[str, str]]) -> str:
        """Direct fallback to local Ollama daemon if FastAPI service is not yet started."""
        payload = {
            "model": model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": 0.2, "num_ctx": 2048}
        }
        req = urllib.request.Request(
            f"{self.ollama_url}/api/chat",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        try:
            with urllib.request.urlopen(req, timeout=30.0) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return data.get("message", {}).get("content", "").strip()
        except Exception as e:
            # Deterministic fallback if Ollama daemon is offline
            return DeterministicFallbackProvider().generate_hypothesis({}, [])

    def generate_hypothesis(self, anomaly_event: Dict[str, Any], context_events: List[Dict[str, Any]]) -> str:
        prompt = (
            f"Analyze this candidate endpoint assessment anomaly and formulate an investigative hypothesis.\n"
            f"Anomaly: {json.dumps(anomaly_event)}\n"
            f"Context: {json.dumps(context_events[:5])}\n"
            f"Return a concise 2-sentence forensic hypothesis explaining whether this suggests external assistance or benign behavior."
        )
        messages = [
            {"role": "system", "content": "You are an autonomous assessment security investigator."},
            {"role": "user", "content": prompt}
        ]
        res = self._call_service("investigation_hypothesis", messages)
        if res:
            return res
        return self._call_ollama_direct("granite4.1:3b", messages)

    def generate_interview_followup(self, transcript: str, concepts: List[str], lang: str) -> str:
        prompt = (
            f"The candidate said: '{transcript}'.\n"
            f"Key technical concepts involved: {', '.join(concepts)}.\n"
            f"Language requirement: {lang}.\n"
            f"Ask an insightful technical follow-up question testing deeper understanding of edge cases or time complexity in {lang}."
        )
        messages = [
            {"role": "system", "content": "You are a senior technical interviewer conducting an adaptive engineering interview."},
            {"role": "user", "content": prompt}
        ]
        res = self._call_service("interview_followup", messages)
        if res:
            return res
        return self._call_ollama_direct("qwen2.5-coder:3b", messages)

    def generate_rubric_explanation(self, test_results: Dict[str, Any], concepts: List[str]) -> str:
        prompt = (
            f"Unit test outcomes: {json.dumps(test_results)}.\n"
            f"Concepts evaluated: {', '.join(concepts)}.\n"
            f"Provide a concise technical summary of candidate proficiency and performance against the rubric."
        )
        messages = [
            {"role": "system", "content": "You are an automated code evaluation rubric engine."},
            {"role": "user", "content": prompt}
        ]
        res = self._call_service("rubric_evaluation", messages)
        if res:
            return res
        return self._call_ollama_direct("qwen2.5-coder:3b", messages)


class DeterministicFallbackProvider(LLMProviderInterface):
    """
    Offline fallback for environments where Ollama has not been started.
    """
    def generate_hypothesis(self, anomaly_event: Dict[str, Any], context_events: List[Dict[str, Any]]) -> str:
        ev_type = anomaly_event.get("event_type", "")
        payload = anomaly_event.get("payload", {})

        if ev_type == "PROCESS_STARTED":
            proc = payload.get("process_name", "")
            return f"Candidate initiated prohibited software ({proc}). Checking if accidental or active session."
        elif ev_type == "DEVICE_CONNECTED":
            cat = payload.get("category", "")
            dev = payload.get("device_id", "")
            return f"Peripheral device of class {cat} ({dev}) connected to workstation."
        elif ev_type == "DISPLAY_TOPOLOGY_CHANGED":
            count = payload.get("display_count", 1)
            return f"Workstation display configuration toggled to {count} monitors."
        return "Observed environmental change during active assessment session."

    def generate_interview_followup(self, transcript: str, concepts: List[str], lang: str) -> str:
        if "two_pointer_technique" in concepts:
            if lang in ("hinglish", "hi"):
                return "Sahi approach hai! Lekin agar array sorted na ho, tab time complexity par kya asar padega?"
            return "Solid approach. What is the time complexity overhead if the input is unsorted?"
        elif "hash_table" in concepts:
            if lang in ("hinglish", "hi"):
                return "Hash map O(1) deta hai, par worst-case collision scenario mein complexity kaise handle karenge?"
            return "A hash map offers O(1) average lookup. How do you handle worst-case hash collisions?"
        return "Can you explain how this solution handles boundary edge cases?"

    def generate_rubric_explanation(self, test_results: Dict[str, Any], concepts: List[str]) -> str:
        passed = test_results.get("test_cases_passed", 0)
        total = test_results.get("total_test_cases", 0)
        return (f"Automated test validation: {passed}/{total} unit tests passed. "
                f"Candidate exhibited understanding of: {', '.join(concepts) if concepts else 'basic syntax'}.")


def get_llm_provider() -> LLMProviderInterface:
    """
    Returns the offline local AI provider.
    Eliminates all cloud fallbacks.
    """
    return LocalAIProvider()
