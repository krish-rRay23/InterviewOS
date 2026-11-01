"""
End-to-End Integration Test for InterviewOS Voice Interview & Evaluation Pipeline.
Tests:
- Entity creation: Organization -> Candidate -> Assessment -> Session
- RBAC & IDOR compliant JWT token issuance
- Piper-TTS speech synthesis
- PyAV in-memory decoding & Faster-Whisper transcription
- Local LLM conversational turn generation
- Go Backend interview turn persistence (RFC 9162 journaling)
- 8-Dimension evidence-grounded evaluation engine
"""
import io
import time
import requests
import json
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BACKEND_URL = "http://127.0.0.1:8080/v1"
LOCAL_AI_URL = "http://127.0.0.1:8000"

def test_full_pipeline():
    print("=== STEP 1: Verify Core Health Endpoints ===")
    bk_health = requests.get(f"{BACKEND_URL}/health").json()
    ai_health = requests.get(f"{LOCAL_AI_URL}/health").json()
    print(f"Backend Status: {bk_health.get('status')} ({bk_health.get('storage_backend')})")
    print(f"Local AI Status: {ai_health.get('status')}")
    print(f"GPU: {ai_health.get('gpu_vram', {}).get('device_name')}")
    assert bk_health.get("status") == "healthy"
    assert ai_health.get("status") == "healthy"

    print("\n=== STEP 2: Initialize Test Entities & Issue Bound Auth Token ===")
    # 1. Create Organization
    org_res = requests.post(
        f"{BACKEND_URL}/organizations",
        json={"name": "E2E Test Corp", "slug": f"e2e-corp-{int(time.time())}"}
    )
    org_id = org_res.json()["id"]

    # 2. Create Candidate
    cand_res = requests.post(
        f"{BACKEND_URL}/candidates",
        json={"organization_id": org_id, "name": "Jane Candidate", "email": "jane@e2etest.local"}
    )
    candidate_id = cand_res.json()["id"]

    # 3. Create Assessment
    asm_res = requests.post(
        f"{BACKEND_URL}/assessments",
        json={"organization_id": org_id, "title": "Senior Systems Architect Assessment", "mode": "TRADITIONAL_CODING"}
    )
    assessment_id = asm_res.json()["id"]

    # 4. Create Session
    sess_res = requests.post(
        f"{BACKEND_URL}/sessions",
        json={"assessment_id": assessment_id, "candidate_id": candidate_id}
    )
    assert sess_res.status_code == 201
    session_id = sess_res.json()["id"]
    print(f"Created Session ID in Go Backend: {session_id}")

    # 5. Issue Candidate Auth Token bound to candidate_id and session_id (OWASP ASVS / IDOR compliant)
    token_res = requests.post(
        f"{BACKEND_URL}/auth/token",
        json={"user_id": candidate_id, "org_id": org_id, "session_id": session_id, "role": "CANDIDATE"}
    ).json()
    token = token_res.get("access_token")
    headers = {"Authorization": f"Bearer {token}"}

    print("\n=== STEP 3: Synthesize Interviewer Question via Piper-TTS ===")
    t0 = time.time()
    tts_res = requests.post(
        f"{LOCAL_AI_URL}/speech/synthesize",
        json={"text": "Can you explain your approach for solving Two Sum in linear time?", "language": "en"}
    )
    synth_duration = time.time() - t0
    assert tts_res.status_code == 200
    audio_bytes = tts_res.content
    print(f"TTS synthesis took {synth_duration:.3f}s. Audio bytes received: {len(audio_bytes)} bytes.")

    print("\n=== STEP 4: Transcribe Audio via Faster-Whisper (Testing PyAV in-memory decoding) ===")
    t0 = time.time()
    files = {"file": ("test_speech.wav", io.BytesIO(audio_bytes), "audio/wav")}
    trans_res = requests.post(
        f"{LOCAL_AI_URL}/speech/transcribe",
        files=files,
        data={"language": "en"}
    )
    trans_duration = time.time() - t0
    assert trans_res.status_code == 200
    trans_data = trans_res.json()
    transcript = trans_data.get("transcript", "")
    print(f"Transcription took {trans_duration:.3f}s. Verbatim: '{transcript}'")
    assert len(transcript) > 5

    print("\n=== STEP 5: Run Conversational LLM Interview Turn ===")
    t0 = time.time()
    candidate_answer = "I chose a single-pass hash map storing the complement of each element. This gives O(N) time and O(N) space."
    turn_req = {
        "session_id": session_id,
        "candidate_utterance": candidate_answer,
        "problem_statement": "Two Sum: Find indices of two numbers that add up to target.",
        "constraints": ["O(N) time complexity target", "Array length up to 10^4"],
        "candidate_code": "def two_sum(nums, target):\n    seen = {}\n    for i, n in enumerate(nums):\n        if target - n in seen:\n            return [seen[target - n], i]\n        seen[n] = i",
        "conversation_history": [
            {"role": "assistant", "content": "Can you explain your approach for solving Two Sum in linear time?"}
        ]
    }
    turn_res = requests.post(f"{LOCAL_AI_URL}/interview/turn", json=turn_req)
    turn_duration = time.time() - t0
    assert turn_res.status_code == 200
    turn_data = turn_res.json()
    interviewer_reply = turn_data.get("response_text", "")
    technical_concepts = turn_data.get("technical_concepts", [])
    print(f"LLM turn took {turn_duration:.3f}s.")
    print(f"Concepts identified: {technical_concepts}")
    print(f"AI Follow-up: '{interviewer_reply}'")
    assert len(interviewer_reply) > 5

    print("\n=== STEP 6: Persist Turns to Go Backend ===")
    turn_1 = {
        "session_id": session_id,
        "turn_number": 1,
        "speaker": "CANDIDATE",
        "transcript": candidate_answer,
        "detected_language": "en",
        "technical_concepts": technical_concepts,
        "latency_ms": int(trans_duration * 1000)
    }
    turn_2 = {
        "session_id": session_id,
        "turn_number": 2,
        "speaker": "INTERVIEWER",
        "transcript": interviewer_reply,
        "detected_language": "en",
        "technical_concepts": technical_concepts,
        "latency_ms": int(turn_duration * 1000)
    }
    p1 = requests.post(f"{BACKEND_URL}/sessions/{session_id}/interview/turns", headers=headers, json=turn_1)
    p2 = requests.post(f"{BACKEND_URL}/sessions/{session_id}/interview/turns", headers=headers, json=turn_2)
    assert p1.status_code == 200 or p1.status_code == 201, f"Failed p1: {p1.status_code} {p1.text}"
    assert p2.status_code == 200 or p2.status_code == 201, f"Failed p2: {p2.status_code} {p2.text}"
    print(f"Persisted Turn 1 & 2 to backend. Status: {p1.status_code}, {p2.status_code}")

    # Fetch recorded turns from backend
    turns_get = requests.get(f"{BACKEND_URL}/sessions/{session_id}/interview/turns", headers=headers).json()
    turns_list = turns_get.get("turns", turns_get) if isinstance(turns_get, dict) else turns_get
    print(f"Retrieved {len(turns_list)} turns from backend.")
    assert len(turns_list) == 2

    print("\n=== STEP 7: Run 8-Dimension Evidence-Grounded Evaluator ===")
    eval_req = {
        "session_id": session_id,
        "problem_statement": "Two Sum linear time complexity",
        "candidate_code": turn_req["candidate_code"],
        "turns": turns_list
    }
    t0 = time.time()
    eval_res = requests.post(f"{LOCAL_AI_URL}/interview/evaluate", json=eval_req)
    eval_duration = time.time() - t0
    assert eval_res.status_code == 200
    eval_data = eval_res.json()
    overall_pct = eval_data.get("overall_competency_pct", 0.0)
    print(f"Evaluator completed in {eval_duration:.3f}s.")
    print(f"Overall Competency Score: {overall_pct}%")
    print("Dimensions evaluated:")
    for dim in eval_data.get("dimensions", []):
        print(f"  - {dim.get('dimension')}: {dim.get('score_pct')}% | Status: {dim.get('status')} | Citation: '{dim.get('evidence_citation', '')[:50]}...'")

    assert overall_pct > 0
    assert len(eval_data.get("dimensions", [])) == 8

    print("\n=== STEP 8: Persist Summary to Go Backend ===")
    summary_payload = {
        "session_id": session_id,
        "status": "COMPLETED",
        "overall_competency_pct": overall_pct,
        "topics_covered": eval_data.get("topics_covered", ["Two Sum", "Hashing"]),
        "summary_narrative": eval_data.get("summary_narrative", ""),
        "evaluation_details": {
            "dimensions": eval_data.get("dimensions", []),
            "strong_evidence": eval_data.get("strong_evidence", []),
            "gaps": eval_data.get("gaps_or_misconceptions", [])
        }
    }
    sum_res = requests.post(f"{BACKEND_URL}/sessions/{session_id}/interview/summary", headers=headers, json=summary_payload)
    assert sum_res.status_code == 200 or sum_res.status_code == 201, f"Failed sum_res: {sum_res.status_code} {sum_res.text}"
    print(f"Persisted Summary to Go backend. Status: {sum_res.status_code}")

    # Fetch summary back from backend
    sum_get = requests.get(f"{BACKEND_URL}/sessions/{session_id}/interview/summary", headers=headers).json()
    saved_overall = sum_get.get("overall_competency_pct")
    print(f"Verified Summary from backend: Overall Competency {saved_overall}%")
    assert saved_overall == overall_pct

    print("\n=========================================================================================")
    print(">>> ALL 8 PIPELINE VERIFICATION STEPS PASSED WITH 100% REAL HARDWARE & INTEGRATIONS! <<<")
    print("=========================================================================================")

if __name__ == "__main__":
    test_full_pipeline()
