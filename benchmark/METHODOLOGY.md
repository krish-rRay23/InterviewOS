# InterviewOS 4.0 Benchmark Methodology & Protocol Specifications

## 1. Overview & Philosophical Foundations

InterviewOS 4.0 establishes a reproducible, mathematically defensible empirical evaluation framework for autonomous assessment platforms. Rather than relying on synthetic mocks or ungrounded assertions, InterviewOS benchmarks are rooted in **direct software observability, verifier integrity verification, and strict decoupling of technical competency from proctoring trust**.

---

## 2. Benchmark Suites

### A. InterviewOS Engineering Benchmark (IOEB)
- **Methodology**: Inspired by HackerRank-Bench principles. 8 long-horizon, real-world engineering assignments covering:
  - Greenfield & Brownfield architectural tasks
  - Sliding-window rate limiters with token replenishment
  - Asymmetric JWT/JWKS token signature validators
  - Multi-tenant Row-Level Security (RLS) query rewriters
  - Transactional Outbox with idempotency and dead-letter queues
  - Resilient Circuit Breakers with jitter backoff
  - Distributed Lease Locks with monotonic fencing tokens
  - Data privacy lifecycle redaction engines
  - Streaming telemetry window aggregators
- **Verification of Verifiers**: Each task is mathematically verified against three reference states before evaluation:
  - Reference implementation $\to 100\%$ score
  - Broken stub implementation $\to 0\%$ score
  - Mutated flawed implementation $\to$ intermediate partial score ($25\% - 80\%$)
- **Trial Repetition**: Evaluated across 3 independent trials reporting Pass@1, Mean Score, Trial Consistency $C = 1 - \frac{\sigma}{\mu}$, latency, token usage, and cost.

---

### B. ASTRA Model Consistency Evaluation
- **Methodology**: Inspired by HackerRank ASTRA model consistency research.
- **Protocol**: 32 repeated trials per task testing response stability, deterministic execution, and standard deviation $\sigma$.
- **Metric**: Consistency index $C = 1 - \frac{\sigma}{\mu}$. Evaluates failure distributions (syntax error, logic flaw, timeout, regression).

---

### C. SWE-Bench Pro V2 Protocol
- **Methodology**: Real software engineering bug reproduction and resolution.
- **Protocol**:
  - `pre_patch`: Verifies that fail-to-pass tests fail and pass-to-pass regression tests pass.
  - `post_patch`: Verifies that fail-to-pass tests are resolved and pass-to-pass regression tests remain 100% green.
  - Patch integrity validation.

---

### D. Terminal-Bench
- **Methodology**: Tool-using agent operations in realistic terminal environments.
- **Tasks**: Forensic log search, process triage, port conflict resolution, configuration policy hardening, and SHA-256 artifact checksum verification.

---

### E. LiveCodeBench Polyglot Harness
- **Methodology**: Evaluates multi-language capabilities across Python 3 and native C++20.
- **Tasks**: Code generation, execution, self-repair of algorithmic edge cases, and test-output prediction.

---

### F. Candidate Assessment Skills Benchmark
- **Methodology**: Technical candidate evaluation strictly decoupled from proctoring signals.
- **Features**: Weighted hidden test suites, partial scoring, Easy/Medium/Hard difficulty tiers, and asymptotic efficiency validation ($O(N)$ vs $O(N^2)$).

---

### G. Assessment Integrity Benchmark
- **Methodology**: 100+ ground truth multi-modal evaluation comparing the InterviewOS Behavioral Investigator and Code Forensics Engine against conventional JPlag/MOSS baselines.
- **Metrics**: Precision, Recall, F1-Score, False Positive Rate (FPR), False Accusations per 1000 sessions, Brier calibration score, ROC-AUC, and defensive `INCONCLUSIVE` rate for ambiguous ambient signals.
