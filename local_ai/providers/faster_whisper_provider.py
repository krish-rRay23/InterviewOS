"""
Faster Whisper Local Speech Recognition Provider.
Runs on CPU using CTranslate2 INT8 quantization to preserve 100% of the
NVIDIA RTX 3050's 4GB VRAM for local LLM inference.
Supports automatic language detection (English, Hindi, multilingual).
"""

import os
import tempfile
from typing import Dict, Any, Optional, Union
import faster_whisper
from local_ai.config.settings import settings

class FasterWhisperProvider:
    def __init__(
        self,
        model_size: Optional[str] = None,
        device: Optional[str] = None,
        compute_type: Optional[str] = None
    ):
        self.model_size = model_size or settings.WHISPER_MODEL_NAME
        self.device = device or settings.WHISPER_DEVICE
        self.compute_type = compute_type or settings.WHISPER_COMPUTE_TYPE
        self._model: Optional[faster_whisper.WhisperModel] = None

    def _ensure_loaded(self):
        if self._model is None:
            self._model = faster_whisper.WhisperModel(
                self.model_size,
                device=self.device,
                compute_type=self.compute_type,
                cpu_threads=4
            )

    def transcribe(
        self,
        audio_input: Union[str, bytes],
        language_hint: Optional[str] = None,
        beam_size: int = 1
    ) -> Dict[str, Any]:
        """
        Transcribes audio (file path or raw bytes) into text with timestamps and language detection.
        """
        self._ensure_loaded()

        temp_path = None
        if isinstance(audio_input, bytes):
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                f.write(audio_input)
                temp_path = f.name
            target_path = temp_path
        else:
            target_path = audio_input

        try:
            kwargs = {"beam_size": beam_size}
            if language_hint and language_hint != "auto":
                kwargs["language"] = language_hint

            segments, info = self._model.transcribe(target_path, **kwargs)

            transcript_segments = []
            full_text_parts = []
            for seg in segments:
                transcript_segments.append({
                    "start": round(seg.start, 2),
                    "end": round(seg.end, 2),
                    "text": seg.text.strip(),
                    "confidence": round(seg.avg_logprob, 3)
                })
                full_text_parts.append(seg.text.strip())

            full_transcript = " ".join(full_text_parts).strip()

            return {
                "transcript": full_transcript,
                "detected_language": info.language,
                "language_probability": round(info.language_probability, 3),
                "duration_seconds": round(info.duration, 2),
                "segments": transcript_segments
            }
        finally:
            if temp_path and os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except Exception:
                    pass


faster_whisper_provider = FasterWhisperProvider()
