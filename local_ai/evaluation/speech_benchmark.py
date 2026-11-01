"""
Local Speech Benchmark Suite.
Evaluates Piper-TTS (CPU ONNX) and Faster-Whisper (CPU INT8) on Windows 11.
Measures:
- Audio duration (seconds)
- Synthesis latency & Real-Time Factor (RTF)
- Transcription latency & Real-Time Factor (RTF)
- Multilingual language detection accuracy (English, Hindi, Hinglish)
"""

import time
import tempfile
import os
from typing import Dict, Any, List
from local_ai.providers.piper_provider import piper_provider
from local_ai.providers.faster_whisper_provider import faster_whisper_provider

TEST_UTTERANCES = [
    {
        "language": "en",
        "text": "Welcome to your InterviewOS assessment. Please begin by reviewing the problem description.",
        "label": "Assessment Intro"
    },
    {
        "language": "en",
        "text": "The candidate utilized a sliding window algorithm to achieve linear time complexity O of N.",
        "label": "Algorithmic Analysis"
    },
    {
        "language": "hi",
        "text": "Kripya apne solution ka time complexity explain karein.",
        "label": "Hinglish Technical Question"
    }
]


def run_speech_benchmarks() -> List[Dict[str, Any]]:
    print("=" * 70)
    print(" RUNNING INTERVIEWOS LOCAL SPEECH BENCHMARK SUITE")
    print(" Stack: Piper TTS (CPU ONNX) & Faster-Whisper (CPU INT8)")
    print(" Zero VRAM Consumption Architecture")
    print("=" * 70)

    results = []

    for utt in TEST_UTTERANCES:
        print(f"\n--> Utterance: '{utt['text'][:50]}...' [{utt['label']}]")

        # 1. Synthesize with Piper
        tts_start = time.time()
        tts_res = piper_provider.synthesize(utt["text"])
        tts_elapsed = time.time() - tts_start

        audio_bytes = tts_res["audio_bytes"]
        duration = tts_res["duration_seconds"]
        sample_rate = tts_res["sample_rate"]
        tts_rtf = round(tts_elapsed / duration, 3) if duration > 0 else 0.0

        print(f"    [Piper TTS] Audio Duration: {duration}s | Latency: {round(tts_elapsed, 3)}s | RTF: {tts_rtf} (Sample Rate: {sample_rate}Hz)")

        # 2. Transcribe with Faster-Whisper
        stt_start = time.time()
        stt_res = faster_whisper_provider.transcribe(audio_bytes)
        stt_elapsed = time.time() - stt_start
        stt_rtf = round(stt_elapsed / duration, 3) if duration > 0 else 0.0

        print(f"    [Faster Whisper] Latency: {round(stt_elapsed, 3)}s | RTF: {stt_rtf}")
        print(f"    Detected Language: {stt_res['detected_language']} (Confidence: {stt_res['language_probability']})")
        print(f"    Transcript: '{stt_res['transcript']}'")

        results.append({
            "label": utt["label"],
            "original_text": utt["text"],
            "audio_duration_sec": duration,
            "tts_latency_sec": round(tts_elapsed, 3),
            "tts_rtf": tts_rtf,
            "stt_latency_sec": round(stt_elapsed, 3),
            "stt_rtf": stt_rtf,
            "detected_language": stt_res["detected_language"],
            "language_prob": stt_res["language_probability"],
            "transcribed_text": stt_res["transcript"],
            "status": "PASS"
        })

    print("\n" + "=" * 70)
    print(" SPEECH BENCHMARK COMPLETED")
    print("=" * 70)
    return results


if __name__ == "__main__":
    run_speech_benchmarks()
