"""
Piper Local Text-to-Speech Provider.
Executes lightweight ONNX speech synthesis on CPU with low latency.
Zero VRAM consumption, preventing interference with local LLM GPU execution.
"""

import os
import io
import wave
import time
from typing import Dict, Any, Optional
import piper
from local_ai.config.settings import settings

class PiperProvider:
    def __init__(
        self,
        model_path: Optional[str] = None,
        config_path: Optional[str] = None
    ):
        self.model_path = model_path or settings.PIPER_MODEL_PATH
        self.config_path = config_path or settings.PIPER_CONFIG_PATH
        self._voice: Optional[piper.PiperVoice] = None

    def _ensure_loaded(self):
        if self._voice is None:
            if not os.path.exists(self.model_path) or not os.path.exists(self.config_path):
                raise FileNotFoundError(f"Piper model files missing: {self.model_path}")
            self._voice = piper.PiperVoice.load(self.model_path, config_path=self.config_path)

    def is_available(self) -> bool:
        return os.path.exists(self.model_path) and os.path.exists(self.config_path)

    def synthesize(self, text: str) -> Dict[str, Any]:
        """
        Synthesizes text into WAV audio bytes.
        Returns dict with:
        - "audio_bytes": bytes
        - "sample_rate": int
        - "duration_seconds": float
        - "latency_seconds": float
        """
        self._ensure_loaded()

        start_time = time.time()
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wav_file:
            self._voice.synthesize_wav(text, wav_file)

        elapsed = time.time() - start_time
        audio_data = buf.getvalue()

        # Calculate duration from wave bytes: length - 44 (header) / (sample_rate * channels * 2)
        sample_rate = self._voice.config.sample_rate
        raw_frames_len = max(0, len(audio_data) - 44)
        duration_sec = raw_frames_len / (sample_rate * 2)

        return {
            "audio_bytes": audio_data,
            "sample_rate": sample_rate,
            "duration_seconds": round(duration_sec, 2),
            "latency_seconds": round(elapsed, 3),
            "size_bytes": len(audio_data)
        }


piper_provider = PiperProvider()
