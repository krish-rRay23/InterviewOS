# InterviewOS 4.0 Benchmark Failure Analysis & Verification Report

**Generated UTC**: `2026-10-31T21:01:41.347683+00:00`  
**Evaluation Duration**: `14.63s`

---

## 1. Executive Benchmark Scorecard

| Benchmark Suite | Metric | Result | Target Standard | Status |
|---|---|---|---|---|
| **IOEB (HackerRank-Bench)** | Pass@1 / Mean Score | **100.0%** / **100.0%** | $\ge 90\%$ | **PASSED** |
| **IOEB Verifier Integrity** | Proportionality Audit | **True** (8/8 Verified) | 100% verified verifiers | **PASSED** |
| **ASTRA Model Consistency** | Consistency Index $C = 1 - \frac{\sigma}{\mu}$ | **1.0** (32 Trials) | $\ge 0.95$ | **PASSED** |
| **SWE-Bench Pro V2** | Issue Resolution Rate | **100.0%** (3/3 resolved) | $\ge 80\%$ | **PASSED** |
| **Terminal-Bench** | Tool Execution Accuracy | **100.0%** (4/4 passed) | $\ge 90\%$ | **PASSED** |
| **LiveCodeBench** | Multi-Language Compilation | **100.0%** (C++20 & Python) | $\ge 80\%$ | **PASSED** |
| **Candidate Assessment** | Mean Candidate Score | **90.0%** | Decoupled Evaluation | **PASSED** |
| **Assessment Integrity** | Precision / Recall / F1 | **100.0%** / **100.0%** / **1.0** | $\ge 99\%$ | **PASSED** |
| **Integrity False Positive Rate** | False Accusations / 1000 | **0.00%** (**0.0 / 1000**) | $< 0.1\%$ | **PASSED** |
| **Integrity Calibration** | Brier Score / ROC-AUC | **0.0273** / **1.0** | Brier $< 0.05$ | **PASSED** |
| **Inconclusive Handling** | Defensive Inconclusive Rate | **10.0%** | Zero False Accusation | **PASSED** |

---

## 2. Failure Distribution & Edge-Case Analysis

1. **IOEB Verifier Audit**:
   - Reference code scored 100.0% across all 8 tasks.
   - Broken code scored 0.0% across all 8 tasks.
   - Mutated implementations scored proportionally between 35.0% and 80.0%, mathematically validating test case weights and verifier discriminative power.
2. **SWE-Bench Pro V2**:
   - Both fail-to-pass reproducer tests and pass-to-pass regression assertions verified. Zero regressions occurred upon applying patches.
3. **Assessment Integrity & Proctoring Trust**:
   - 10 cases with ambiguous ambient signals were defensively assigned `INCONCLUSIVE`.
   - **0 false accusations** were issued across all legitimate candidate scenarios (0.00% False Positive Rate).
