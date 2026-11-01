"""
Faster Whisper Local Speech Recognition Provider.
Runs on CPU using CTranslate2 INT8 quantization to preserve 100% of the
NVIDIA RTX 3050's 4GB VRAM for local LLM inference.
Supports automatic language detection (English, Hindi, multilingual).
Uses PyAV for robust in-memory container decoding (WebM/Opus, MP4/AAC, WAV, OGG)
without relying on external system ffmpeg executables.
"""

import io
import os
import tempfile
from typing import Dict, Any, Optional, Union
import av
import numpy as np
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

    def is_available(self) -> bool:
        """Verifies model loading without throwing exception."""
        try:
            self._ensure_loaded()
            return self._model is not None
        except Exception:
            return False

    def decode_audio_to_pcm16_array(self, audio_bytes: bytes) -> np.ndarray:
        """
        Decodes any supported audio container (WebM, MP4, WAV, OGG, MP3)
        to a float32 16kHz mono numpy array using PyAV.
        """
        input_io = io.BytesIO(audio_bytes)
        container = av.open(input_io)
        resampler = av.AudioResampler(format='flt', layout='mono', rate=16000)

        audio_frames = []
        for frame in container.decode(audio=0):
            for resampled in resampler.resample(frame):
                audio_frames.append(resampled.to_ndarray())
        container.close()

        if not audio_frames:
            return np.zeros(0, dtype=np.float32)

        waveform = np.concatenate(audio_frames, axis=1).squeeze()
        return waveform

    def transcribe(
        self,
        audio_input: Union[str, bytes],
        language_hint: Optional[str] = None,
        beam_size: int = 1
    ) -> Dict[str, Any]:
        """
        Transcribes audio into text with timestamps and language detection.
        Decodes raw bytes in-memory through PyAV directly into float32 array.
        """
        self._ensure_loaded()

        if isinstance(audio_input, bytes):
            try:
                waveform = self.decode_audio_to_pcm16_array(audio_input)
                if len(waveform) < 160:  # less than 10ms of audio
                    return {
                        "transcript": "",
                        "detected_language": language_hint or "en",
                        "language_probability": 0.0,
                        "duration_seconds": 0.0,
                        "segments": []
                    }
                target = waveform
            except Exception as decode_err:
                # Fallback to temp file if PyAV stream parsing fails
                with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
                    f.write(audio_input)
                    target = f.name
        else:
            target = audio_input

        try:
            kwargs = {"beam_size": beam_size}
            if language_hint and language_hint != "auto":
                kwargs["language"] = language_hint

            segments, info = self._model.transcribe(target, **kwargs)

            transcript_segments = []
            full_text_parts = []
            for seg in segments:
                text = seg.text.strip()
                if text:
                    transcript_segments.append({
                        "start": round(seg.start, 2),
                        "end": round(seg.end, 2),
                        "text": text,
                        "confidence": round(seg.avg_logprob, 3)
                    })
                    full_text_parts.append(text)

            full_transcript = " ".join(full_text_parts).strip()

            return {
                "transcript": full_transcript,
                "detected_language": info.language,
                "language_probability": round(info.language_probability, 3),
                "duration_seconds": round(info.duration, 2),
                "segments": transcript_segments
            }
        finally:
            if isinstance(target, str) and os.path.exists(target):
                try:
                    os.remove(target)
                except Exception:
                    pass


faster_whisper_provider = FasterWhisperProvider()
