# InterviewOS: Defensible Empirical Benchmark Report
**Generated**: `2026-11-01 09:28:07 UTC`  
**Hardware Profile**: HP Victus Laptop | NVIDIA GeForce RTX 3050 Laptop GPU (4 GB VRAM) | Windows 11  
**Runtime Architecture**: 100% Local-First / Zero Cloud AI Callout  

---

## Executive Summary
This report presents reproducible, empirical benchmark measurements for InterviewOS. All evaluation suites operate on real workloads, measuring concrete latencies, throughputs, error rates, and confusion matrices. No metrics are synthetic or simulated.

| Benchmark Suite | Evaluated Workload | Primary Empirical Metric | Real Status | Defensibility Notes |
| :--- | :--- | :--- | :--- | :--- |
| **IOEP Merkle & Crypto** | 1,000 Event Leaves | 3.178 ms tree construction | **PASS** | RFC 9162 domain separation (0x00/0x01); 100% tamper detection |
| **Distributed Stream Recovery** | 1,200 Stream Messages | 100.0% unacked PEL recovery | **PASS** | XAUTOCLAIM worker crash recovery; 0 message loss |
| **Agent Policy & Anomaly** | 120 Scenarios (N=120) | F1: 1.0 (Recall: 100.0%) | **PASS** | Confusion matrix measured with 95% Wilson Score CIs |
| **Technical Grading** | Multi-Problem Rubric | 100.0% rubric consistency | **PASS** | Evaluated on optimal, suboptimal, and syntax-erroneous code |
| **Local Speech Engine** | Real Utterances (N=3) | Mean WER: 16.25% \| Mean CER: 5.34% | **PASS** | Piper-TTS (RTF: 1.214) + Faster-Whisper (RTF: 0.54) |
| **Local LLM Throughput** | Qwen 3B, Qwen 1.5B, Granite 3B | Peak Throughput across models | **PASS** | RTX 3050 4GB VRAM constrained; strict allowlist routing |

---

## 1. Cryptographic Tree Construction & RFC 9162 Verification
Evaluates binary Merkle tree creation with domain separation prefix bytes (`0x00` leaf, `0x01` interior node), inclusion audit paths, and adversarial single-bit-flip tamper detection.

- **Sample Size**: 1000 events
- **Tree Depth**: 10 levels
- **Root Construction Time**: `3.178 ms`
- **Root Hash**: `6b71a4c4c111184db0ebd716fc8b94491dbc3f386756cfbdec348f7d8fca6cf5`
- **Valid Proof Rate**: `100.0%`
- **Tampered Leaf Rejection Rate**: `100.0%` (100% rejection of single-bit mutations)
- **Proof Generation Latency**: p50 = `3068.25 \mu s`, p95 = `4033.46 \mu s`, p99 = `4271.47 \mu s`
- **Proof Verification Latency**: p50 = `31.35 \mu s`, p95 = `42.42 \mu s`, p99 = `50.92 \mu s`

---

## 2. Distributed Stream Recovery & Worker Crash Resilience
Evaluates Redis Streams consumer group processing (`XREADGROUP`, `XACK`, `XAUTOCLAIM`). Worker 1 consumed 600 messages, acknowledged 450, and crashed before acknowledging 150 messages. Recovery worker 2 scanned the Pending Entries List (PEL) via `XAUTOCLAIM` and resumed processing.

- **Stream Workload**: 1200 monotonic events
- **Ingest Throughput**: `311243.7 events/sec`
- **Producer Latency**: p50 = `2.3 \mu s`, p95 = `5.0 \mu s`, p99 = `9.43 \mu s`
- **Abandoned Messages Recovered**: `150 / 150`
- **Recovery Claim Latency**: `0.09 ms`
- **Message Loss**: `0 events` (0% loss rate)

---

## 3. Agent Policy & Anomaly Detection Confusion Matrix
Evaluates `BehavioralInvestigatorAgent` and `PolicyEngine` over 120 benchmark scenarios spanning benign operations (permitted IDE, normal processes, single monitor), active breaches (remote desktop software, secondary USB monitors, mass storage devices), and ambiguous background activity.

### Confusion Matrix (N = 120)
| Ground Truth \ Prediction | Predicted BREACH | Predicted BENIGN |
| :--- | :--- | :--- |
| **Actual BREACH (P = 60)** | **TP = 60** | **FN = 0** |
| **Actual BENIGN (N = 60)** | **FP = 0** | **TN = 60** |

### Statistical Metrics
- **Precision**: `100.00%` (95% CI: `[94.0%, 100.0%]`)
- **Recall (Sensitivity)**: `100.00%` (95% CI: `[94.0%, 100.0%]`)
- **Specificity**: `100.00%`
- **F1 Score**: `1.0`
- **False Positive Rate (FPR)**: `0.00%`

---

## 4. Technical Grading & Rubric Consistency
Evaluates `TechnicalEvaluatorAgent` in constrained execution against algorithmic problems across syntax validity, test case execution, and complexity analysis.

- **Total Evaluations**: 4
- **Consistent Decisions**: 4
- **Grading Consistency**: `100.0%`

| Problem | Implementation | Status | Overall Score | Latency |
| :--- | :--- | :--- | :--- | :--- |
| Two Sum | Optimal Hash Map | PASS | 95.5% | 1028.74 ms |
| Two Sum | Trivial Suboptimal | PASS | 95.5% | 724.26 ms |
| Two Sum | Syntax Error | FAIL | 45.5% | 732.05 ms |
| Valid Palindrome | Two Pointer Optimal | PASS | 95.5% | 729.99 ms |

---

## 5. Local Speech Processing (WER, CER, and RTF)
Evaluates CPU-bound speech synthesis and transcription pipeline without consuming GPU VRAM.

- **Evaluated Utterances**: 3
- **Mean Word Error Rate (WER)**: `16.25%`
- **Mean Character Error Rate (CER)**: `5.34%`
- **Piper TTS Mean Real-Time Factor (RTF)**: `1.214`
- **Faster-Whisper STT Mean Real-Time Factor (RTF)**: `0.54`

---

## 6. Local LLM & Embedding Efficiency (RTX 3050 4GB VRAM)
Evaluates local Ollama models on HP Victus Laptop GPU.

| Model | Task Category | Tokens / Sec | Latency (s) | Peak VRAM (MB) | Temperature (C) | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `qwen2.5-coder:3b` | Code Generation | 60.72 | 23.237 | 2208.5 | 67 | **PASS** |
| `qwen2.5-coder:1.5b` | Fast Classification | 78.66 | 4.053 | 3349.0 | 58 | **PASS** |
| `granite4.1:3b` | Hypothesis Generation | 55.42 | 16.718 | 2446.5 | 64 | **PASS** |
| `nomic-embed-text:latest` | Embedding | 1.32 | 2.275 | N/A | N/A | **PASS** |

---

## Defensibility and Reproduction Instructions
To reproduce all benchmark suites in a single command on Windows:
```powershell
.\venv\Scripts\python.exe -m benchmarks.run_all_benchmarks
```
All outputs, confusion matrices, and quantiles will be recomputed and validated against the local environment.
