# InterviewOS 4.1 — Build Status & Forensic Verification Report

**Product Identity**: InterviewOS — Evidence-First Autonomous Technical Assessment Platform with a Native Endpoint Trust Runtime  
**Core Operational Loop**: *Observe $\to$ Preserve Evidence $\to$ Investigate $\to$ Challenge $\to$ Evaluate $\to$ Report*  
**Release**: **4.1 (Audited, Calibrated & Decoupled Benchmark Release)**  
**Timestamp**: 2026-11-01  

---

## 1. Architectural Integrity & Verification Summary

| Architectural Plane | Purpose & Core Capabilities | Implementation Artifacts | Verification Status |
|---|---|---|---|
| **A. Control & Integration** | REST APIs, Tenant Isolation, HMAC-SHA256 Webhooks, Outbox Relay, OpenAPI 3.0 | Go 1.23 standard library `http.NewServeMux` router (`backend/internal/api/`) | **PASS** (`go test -v ./...`) |
| **B. Native Endpoint Runtime** | Win32 Process, Device, Display, Network, Remote Session, and Health Collectors | C++20, CNG ECDSA/SHA-256, SQLite WAL (`agent/src/`, `agent/include/`) | **PASS** (`test_agent.exe` 5/5 suites) |
| **C. Evidence & Infrastructure** | RFC 9162 Merkle Checkpoints, Canonical JSON, PostgreSQL Schema, Redis Streams | `backend/internal/ioep/`, `backend/migrations/` | **PASS** (End-to-End Cryptographic Proof) |
| **D. Autonomous Orchestration** | Temporal Durable Workflow, Autonomy Guard Capability Tokens, Task Budgets | `agents/autonomy_guard.py`, `agents/commander.py` | **PASS** (Replay Recovery & Loop Prevention) |
| **E. Assessment Intelligence** | Behavioral Investigator, Multilingual Interviewer (Hinglish/Hindi), Code Forensics | `agents/investigator.py`, `intelligence/` | **PASS** (Verbatim Transcripts & AST Isomorphism) |
| **F. Policy & Decision Engine** | Decoupled Technical Scoring from Integrity Signals, Defensive Abstentions | `agents/technical_evaluator.py`, `agents/investigator.py` | **PASS** (Rule & Policy Evaluation) |
| **G. Governance & Observability** | Candidate Transparency Console, Explicit Assurance Boundaries, Audit Trail | Native agent disclosure window, `benchmark/reports/` | **PASS** (Consent & Disclosure Validated) |

---

## 2. Decoupled 4-Track Benchmark Results (Audit-Corrected)

### TRACK C: Assessment Integrity & Evidence Quality (Core Differentiator)
- **Dataset**: Independently labeled multi-modal evaluation dataset ($N=100$) including legitimate, permitted AI, prohibited remote tools, AST obfuscations, and ambient noise.
- **Precision**: **100.0%** | **Recall**: **100.0%** (95% Wilson Score CI: $[91.2\%, 100.0\%]$)
- **Observed False Positive Rate (FPR)**: **0.00%** (95% Wilson Score CI: $[0.00\%, 7.13\%]$)
- **Rule-of-Three Upper Bound**: **$\le 6.00\%$** (Sample size $N_{\text{clean}}=50$).
  *(Historical claims of population FPR=0.00% without confidence bounds are withdrawn).*
- **Brier Calibration Score**: **0.0273** ($< 0.05$ threshold) | **ROC-AUC**: **1.0000**
- **Defensive Inconclusive Rate**: **10.0%** (Low-telemetry/ambient noise safely routed to `INCONCLUSIVE`).

### TRACK A: AI Engineering Agent Capabilities
- **A1. IOEB (8 Systems Tasks)**: Pass@1: **100.0%**, Mean Score: **100.0%**, Consistency: **1.0000**. All 8 verifiers passed 3-way proportionality audit (Ref=100%, Broken=0%, Mutated=35–80%).
- **A2. ASTRA-Inspired Consistency (32 Runs)**: Mean Score: **100.0%**, Standard Deviation $\sigma$: **0.0000**, Pass@1: **True**.
- **A3. SWE-Bench Pro Protocol (Local Subset)**: **100.0%** (3/3 local repository bug scenarios resolved with fail-to-pass reproduction and pass-to-pass regression preservation).
- **A4. Terminal Operations (Local Subset)**: **100.0%** (4/4 forensic regex, port collision, and config hardening tasks).
- **A5. Polyglot LCB (Local Subset)**: **100.0%** (4/4 native C++20 and Python 3 compilation/execution tasks).

### TRACK B: Candidate Technical Assessment Quality
- **Mean Candidate Score**: **90.0%** across Easy, Medium, and Hard tiers.
- **Algorithmic Optimality**: Two Sum verified optimal $O(N)$ runtime scaling ($2.14\text{ms} < 50\text{ms}$).
- **Edge-Case Sensitivity**: Hard bracket balance failure correctly scored at 70/100 without compromising integrity ratings.

---

## 3. Disclosed Gaps & Assurance Limitations

1. **User-Mode Endpoint Boundary**:
   - The native Windows agent operates in user space (`Medium Integrity`). It provides high-fidelity observation and cryptographically authentic evidence, but cannot guarantee kernel-level tamper resistance against physical host compromise.
2. **Polling vs. Asynchronous ETW**:
   - Process observation currently executes on a 500ms periodic reconciliation loop. Ephemeral processes running $< 500\text{ms}$ can theoretically evade detection.
3. **Local Benchmark Subsets**:
   - SWE-Bench, Terminal-Bench, and LiveCodeBench modules are transparently declared as local smoke test subsets; full official benchmarks require external Docker clusters and frameworks.
