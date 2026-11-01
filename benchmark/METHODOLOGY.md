# InterviewOS 4.1 Benchmark Methodology & Evaluation Protocol

## 1. Philosophical Foundations & Integrity Safeguards

InterviewOS 4.1 rejects artificial 100% metrics and establishes an **independently verifiable, statistically sound benchmark methodology**. 

A credible 75% score on a challenging, non-leaked benchmark is infinitely more valuable than an artificial 100% score on a cherry-picked demonstration.

### Permanent Integrity Safeguards
1. **No Circular Self-Grading**: Evaluation rules and ground truth labels are authored independently from the system's runtime classification logic.
2. **Denominators are Invariable**: Every initiated task remains in the denominator. Failures, timeouts, and execution crashes are never dropped or silently retried.
3. **Statistical Uncertainty Disclosed**: Every classification metric includes exact sample sizes ($N$) and 95% Clopper-Pearson or Wilson binomial confidence intervals.
4. **Honest Labeling of Smoke Tests vs Official Benchmarks**: A local test runner executing a subset of tasks must never be labelled as the official benchmark. When official harnesses or complete datasets are unavailable, they are explicitly declared as **Local Smoke Tests** or **Partially Reproduced Subsets**.
5. **Decoupled Evaluation Tracks**: AI agent engineering skills (Track A) are never merged with Candidate technical skill scoring (Track B) or Assessment integrity accuracy (Track C).

---

## 2. Benchmark Architecture: 4 Disciplinary Tracks

```
┌────────────────────────────────────────────────────────────────────────┐
│                   INTERVIEWOS 4.1 BENCHMARK LABORATORY                 │
├────────────────────┬────────────────────┬──────────────────────────────┤
│ TRACK A: AGENT     │ TRACK B: CANDIDATE │ TRACK C: INTEGRITY           │
│ ENGINEERING SKILLS │ ASSESSMENT QUALITY │ & EVIDENCE FIDELITY          │
├────────────────────┼────────────────────┼──────────────────────────────┤
│ • IOEB (8 Tasks)   │ • Algorithmic Tests│ • 100+ Multi-Modal Dataset   │
│ • ASTRA Consistency│ • Efficiency / O(N)│ • JPlag/MOSS vs Behavioral   │
│ • SWE Smoke Test   │ • Edge Cases       │ • 95% Confidence Bounds      │
│ • Terminal Smoke   │ • Rubric Agreement │ • Brier Calibration          │
│ • Polyglot LCB     │ • Code Fluency     │ • Defensive Inconclusives    │
├────────────────────┴────────────────────┴──────────────────────────────┤
│ TRACK D: PLATFORM RELIABILITY & DISTRIBUTED SYSTEMS                    │
│ • Ingestion Throughput • Checkpoint Latency • Outbox Replay Durability │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Track Protocols

### TRACK A — AI Engineering Agent Performance
Evaluates agent problem-solving capabilities when acting as a software engineer.
- **A1. IOEB (InterviewOS Engineering Benchmark)**:
  - 8 long-horizon systems engineering tasks (Rate Limiter, JWT/JWKS, Multi-Tenant RLS, Outbox Dedupe, Circuit Breaker, Distributed Lease, Privacy Redaction, Time Series Window Aggregator).
  - Every task is validated against a 3-way proportionality audit (Reference = 100%, Broken = 0%, Mutated = 35–80%).
  - Evaluated across 3 trials reporting Pass@1, Mean Score, Latency, and Cost.
- **A2. ASTRA-Inspired Consistency Evaluation**:
  - Measures score distribution and stability across 32 repeated runs.
  - Reports Mean ($\mu$), Standard Deviation ($\sigma$), Pass@1, Pass@K, and failure distributions.
- **A3. SWE-Bench Pro Protocol (Smoke Test Subset)**:
  - Validates fail-to-pass reproduction and pass-to-pass regression avoidance on repository bug scenarios.
  - Declared as a 3-task local verification suite (Official 642-task benchmark requires external Docker cluster).
- **A4. Terminal-Bench (Smoke Test Subset)**:
  - Evaluates tool-assisted regex log parsing, port collision triage, and artifact checksum verification.
- **A5. Polyglot LiveCodeBench (Smoke Test Subset)**:
  - Multi-language compilation and execution in Python 3 and native C++20.

### TRACK B — Candidate Technical Assessment Quality
Evaluates the assessment engine's ability to grade human candidate engineering skills, completely decoupled from proctoring or integrity telemetry.
- Weighted partial test cases.
- Execution boundary conditions and hidden test suites.
- Asymptotic efficiency validation ($O(N)$ vs $O(N^2)$ runtime scaling).

### TRACK C — Assessment Integrity & Evidence Quality
The core differentiator of InterviewOS. Evaluates the multi-modal Behavioral Investigator and Code Forensics Engine on an independently adjudicated ground-truth dataset ($N=100$).
- **Metrics Computed**:
  - Confusion Matrix (TP, FP, TN, FN).
  - Precision, Recall, Specificity, F1-Score.
  - False Positive Rate (FPR) and False Negative Rate (FNR).
  - 95% Clopper-Pearson Exact Binomial Confidence Intervals:
    $$\text{CI}_{95\%} = \left[ 1 + \frac{n - k + 1}{k \cdot F_{0.025}(2k, 2(n-k+1))}, \, 1 + \frac{n - k}{(k+1) \cdot F_{0.975}(2(k+1), 2(n-k))} \right]$$
  - Rule-of-Three bound on zero false positives: $\text{FPR}_{95\% \text{ upper}} \approx \frac{3}{N_{\text{clean}}}$.
  - Calibration Brier Score: $\frac{1}{N} \sum_{i=1}^N (p_i - y_i)^2$.
  - Inconclusive Rate: Percentage of ambiguous or low-telemetry sessions safely abstained to prevent wrongful candidate accusation.

### TRACK D — Platform Reliability & Distributed Infrastructure
Evaluates the native Windows endpoint and backend services under actual stress:
- Cryptographic Merkle tree batch construction latency.
- SQLite WAL journaling append throughput.
- Monotonic sequence integrity under offline buffering and network reconnect.
- Replay recovery across simulated worker interruptions.
