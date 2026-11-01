"""
Real Speech Benchmark Suite for InterviewOS.
Evaluates local speech stack: Piper-TTS (CPU ONNX) & Faster-Whisper (CPU INT8).
Calculates empirical Word Error Rate (WER), Character Error Rate (CER),
and Real-Time Factor (RTF) across realistic assessment dialogue.
"""

import time
from typing import Dict, Any, List
from local_ai.providers.piper_provider import piper_provider
from local_ai.providers.faster_whisper_provider import faster_whisper_provider


def compute_levenshtein(a: List[str], b: List[str]) -> int:
    """Computes Levenshtein edit distance between two token sequences."""
    n, m = len(a), len(b)
    if n == 0:
        return m
    if m == 0:
        return n
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        dp[i][0] = i
    for j in range(m + 1):
        dp[0][j] = j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,       # deletion
                dp[i][j - 1] + 1,       # insertion
                dp[i - 1][j - 1] + cost # substitution
            )
    return dp[n][m]


def compute_wer(reference: str, hypothesis: str) -> float:
    ref_words = reference.lower().strip().split()
    hyp_words = hypothesis.lower().strip().split()
    if not ref_words:
        return 0.0 if not hyp_words else 1.0
    dist = compute_levenshtein(ref_words, hyp_words)
    return dist / len(ref_words)


def compute_cer(reference: str, hypothesis: str) -> float:
    ref_chars = list(reference.lower().strip().replace(" ", ""))
    hyp_chars = list(hypothesis.lower().strip().replace(" ", ""))
    if not ref_chars:
        return 0.0 if not hyp_chars else 1.0
    dist = compute_levenshtein(ref_chars, hyp_chars)
    return dist / len(ref_chars)


UTTERANCES = [
    {
        "id": "utt_1",
        "reference": "Please explain your approach to solving the two sum problem in linear time.",
        "label": "Prompt Question"
    },
    {
        "id": "utt_2",
        "reference": "I created a hash table to store the complement value of each integer seen so far.",
        "label": "Candidate Explanation"
    },
    {
        "id": "utt_3",
        "reference": "The time complexity is order N and the space complexity is also order N.",
        "label": "Complexity Analysis"
    }
]


def run_speech_benchmark_real() -> Dict[str, Any]:
    print("=" * 70)
    print(" EMPIRICAL SPEECH ACCURACY & RTF BENCHMARK")
    print(" Stack: Piper TTS (CPU ONNX) + Faster-Whisper (CPU INT8)")
    print("=" * 70)

    results = []
    wers = []
    cers = []
    tts_rtfs = []
    stt_rtfs = []

    for utt in UTTERANCES:
        ref = utt["reference"]
        print(f"\n--> Evaluating: '{ref[:45]}...'")

        # 1. Synthesize Audio
        t0 = time.perf_counter()
        synth = piper_provider.synthesize(ref)
        tts_elapsed = time.perf_counter() - t0
        audio_duration = synth["duration_seconds"]
        tts_rtf = tts_elapsed / audio_duration if audio_duration > 0 else 0.0
        tts_rtfs.append(tts_rtf)

        # 2. Transcribe Audio
        t0 = time.perf_counter()
        trans = faster_whisper_provider.transcribe(synth["audio_bytes"])
        stt_elapsed = time.perf_counter() - t0
        stt_rtf = stt_elapsed / audio_duration if audio_duration > 0 else 0.0
        stt_rtfs.append(stt_rtf)

        hyp = trans["transcript"]
        wer = compute_wer(ref, hyp)
        cer = compute_cer(ref, hyp)
        wers.append(wer)
        cers.append(cer)

        print(f"    Reference:  '{ref}'")
        print(f"    Hypothesis: '{hyp}'")
        print(f"    WER: {wer*100:.1f}% | CER: {cer*100:.1f}%")
        print(f"    TTS RTF: {tts_rtf:.3f} | STT RTF: {stt_rtf:.3f}")

        results.append({
            "id": utt["id"],
            "reference": ref,
            "hypothesis": hyp,
            "wer": round(wer, 4),
            "cer": round(cer, 4),
            "tts_rtf": round(tts_rtf, 4),
            "stt_rtf": round(stt_rtf, 4),
            "detected_lang": trans["detected_language"]
        })

    avg_wer = sum(wers) / len(wers) if wers else 0.0
    avg_cer = sum(cers) / len(cers) if cers else 0.0
    avg_tts_rtf = sum(tts_rtfs) / len(tts_rtfs) if tts_rtfs else 0.0
    avg_stt_rtf = sum(stt_rtfs) / len(stt_rtfs) if stt_rtfs else 0.0

    summary = {
        "utterances_evaluated": len(results),
        "mean_wer_pct": round(avg_wer * 100, 2),
        "mean_cer_pct": round(avg_cer * 100, 2),
        "mean_tts_rtf": round(avg_tts_rtf, 3),
        "mean_stt_rtf": round(avg_stt_rtf, 3),
        "details": results
    }

    print("\n" + "=" * 70)
    print(f"  Summary: Mean WER={summary['mean_wer_pct']}% | Mean CER={summary['mean_cer_pct']}%")
    print(f"  Throughput: TTS RTF={summary['mean_tts_rtf']} | STT RTF={summary['mean_stt_rtf']}")
    print("=" * 70)
    return summary


if __name__ == "__main__":
    run_speech_benchmark_real()
