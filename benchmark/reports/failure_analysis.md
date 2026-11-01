# InterviewOS 4.1 Benchmark Evaluation & Statistical Analysis Report

**Generated UTC**: `2026-11-01T04:15:20.620436+00:00`  
**Evaluation Duration**: `12.63s`  
**Methodology Standard**: Decoupled 4-Track Empirical Evaluation with Wilson / Clopper-Pearson Confidence Intervals.

---

## 1. Track C: Assessment Integrity & Statistical Disclosure

The Assessment Integrity Benchmark evaluates the multi-modal Behavioral Investigator and Code Forensics Engine against an independently labeled ground-truth dataset ($N=100$).

### Core Classification Metrics & 95% Confidence Bounds

| Metric | Measured Value | 95% Confidence Interval | Method / Interpretation |
|---|---|---|---|
| **True Positives (TP)** | `40` | N/A | Correctly flagged policy breaches |
| **False Positives (FP)** | `0` | N/A | Zero clean candidates accused |
| **True Negatives (TN)** | `50` | N/A | Clean sessions validated |
| **False Negatives (FN)** | `0` | N/A | Violations missed |
| **Precision** | **100.0%** | $[91.2\%, 100.0\%]$ | Positive predictive value |
| **Recall (Sensitivity)** | **100.0%** | $[91.2\%, 100.0\%]$ | Wilson score binomial interval |
| **Observed False Positive Rate** | **0.00%** | $[0.00\%, 7.13\%]$ | Wilson score binomial interval |
| **Rule-of-Three 95% Upper Bound** | **$\le 6.00\%$** | Upper 95% bound | Given $FP=0$ in $N=50$ trials |
| **Brier Calibration Score** | **0.0273** | Mean Squared Probability Error | Strong calibration ($< 0.05$) |
| **ROC-AUC** | **1.0000** | Area Under Curve | Non-parametric rank metric |
| **Defensive Inconclusive Rate** | **10.0%** | Safety Policy | $10$ low-telemetry cases abstained |

> [!IMPORTANT]
> **Statistical Disclosure on Zero False Positives**:
> An observed sample FPR of 0.00% across N=50 clean sessions does **not** prove that the population error rate is zero. Under the mathematical Rule of Three, 50 clean sessions with zero false positives establish an upper 95% confidence bound of approximately **<= 6.00%**. Approximately 3,000 independent legitimate sessions with zero false positives would be required to support an upper bound near 0.1%.

---

## 2. Track A: AI Engineering Agent Performance

### A1. IOEB (HackerRank-Bench Paradigm)
- **Verified Proportionality**: 8/8 verifiers mathematically verified against 3 implementations:
  - Reference implementation: $100.0\%$
  - Broken implementation: $0.0\%$
  - Mutated implementation: $35.0\% - 80.0\%$
- **Pass@1**: 100.0% | **Mean Score**: 100.0% | **Consistency**: 1.0

### A2. ASTRA-Inspired Consistency Evaluation (32 Repeated Runs)
- Applied the HackerRank ASTRA evaluation protocol across 32 runs.
- **Mean Score**: 100.0% | **Standard Deviation**: 0.0 | **Pass@1**: True

### A3–A5. Local Smoke Test Subsets Disclosures
- **SWE-Bench Pro Protocol**: 3/3 local bug scenarios verified for fail-to-pass reproduction and pass-to-pass regression avoidance. (Official 642-task Docker benchmark is declared unavailable locally).
- **Terminal Operations**: 4/4 tool execution tasks passed (regex log parsing, PID port conflict triage, config hardening, checksum verification).
- **Polyglot Compilation**: 4/4 compilation and execution tasks passed in C++20 and Python 3.

---

## 3. Track B: Candidate Technical Assessment Quality

- **Evaluated Challenges**:
  - Two Sum ($O(N)$ hash table vs $O(N^2)$ brute force): **100/100** (Optimal complexity)
  - Merge Intervals (Boundary condition handling): **100/100** (Hidden tests passed)
  - Longest Valid Parentheses ($O(N)$ stack parsing): **70/100** (Edge case failure on malformed balance)
- **Mean Candidate Score**: **90.0%** (Decoupled from proctoring signals)
