# InterviewOS: Autonomous Agentic Assessment Operating System

> **Observe. Preserve Evidence. Investigate. Challenge. Verify. Evaluate.**

**InterviewOS** is an autonomous agentic assessment operating system combining native Windows endpoint trust intelligence, multi-agent autonomous orchestration, cryptographic evidence verification, behavioral code-forensics, and multilingual technical interviewing.

Designed for high-integrity technical interviewing, InterviewOS runs on a **100% Local-First / Zero Cloud AI** architecture with hardware-tuned efficiency for consumer laptops (such as the HP Victus with NVIDIA RTX 3050 4GB VRAM).

---

## 1. Architectural Overview: The Seven Planes

InterviewOS is engineered around seven logical planes:

1. **Control and Integration Plane**:
   - High-performance Go REST API server with OpenAPI 3.0 documentation (`/v1/openapi.json`, `/v1/docs`).
   - Server-side JWT authentication (HS256) with role-based access control (RBAC): `CANDIDATE`, `INTERVIEWER`, `ASSESSMENT_ADMIN`, `ORG_ADMIN`, `SYSTEM_OPERATOR`.
   - Token-bucket rate limiting, restrictive CORS policies, and strict IDOR/tenant isolation validation.
2. **Endpoint Trust Runtime**:
   - Native Windows 11 C++20 endpoint agent with 7 native collectors: `Process`, `Device`, `Display`, `Network`, `RemoteSession`, `Health`, and `Bluetooth`.
   - Windows Cryptography Next Generation (CNG BCrypt) ECDSA P-256 and SHA-256 cryptographic engine.
   - Local SQLite / WAL journal with monotonic sequence numbering and offline buffer resilience.
   - Visible Candidate Transparency Console disclosing monitored telemetry categories and assuring privacy (no keystroke logging, no file scanning, no arbitrary memory dumping).
3. **Evidence and Data Infrastructure**:
   - IOEP (InterviewOS Evidence Protocol) schema verification and incremental hash chaining ($H_i = \text{SHA256}(\text{session} \parallel \text{seq} \parallel H_{i-1} \parallel \text{payload})$).
   - Binary Merkle tree checkpoints with strict RFC 9162 domain separation (`0x00` leaf, `0x01` interior node) and cryptographic inclusion/consistency proofs.
   - Dual-persistence architecture: High-performance `MemoryStore` for local development and durable `PostgresStore` with connection pooling, migrations (`backend/migrations/001_init.sql`), and transactional outbox.
   - Real Redis Streams message broker implementing `XADD`, `XREADGROUP`, `XACK`, and `XAUTOCLAIM` recovery for dead-worker crash recovery.
4. **Autonomous Orchestration Plane**:
   - Assessment Commander orchestrator and Autonomy Guard capability authorization gate enforcing signed capability tokens, tool budgets, and loop prevention.
   - Real Temporal Python SDK durable workflows (`@workflow.defn`, `@activity.defn`) with exponential backoff retries, timeouts, and heartbeat checkpoints.
   - Deterministic offline replay harness for instant verification of worker restart recovery.
5. **Assessment Intelligence Plane**:
   - Behavioral Investigator executing structured scientific inquiry (`OBSERVE` $\to$ `HYPOTHESIZE` $\to$ `INVESTIGATE` $\to$ `VALIDATE` $\to$ `ACT` $\to$ `UPDATE`).
   - Code Forensics engine analyzing Tree-sitter AST isomorphism and structural token similarity.
   - Multilingual Technical Interviewer supporting English, Hindi, and Hinglish with natural code-switching and verbatim transcript grounding.
   - Dynamic Adaptive Challenge engine generating algorithmic verification problems tailored to candidate code.
6. **Execution & Security Boundary**:
   - Hardened container sandbox with non-root user, read-only rootfs, disabled networking (`--network none`), memory quotas (128 MB), CPU throttling, and PID limits.
   - **Fail-Closed Security Policy**: Unconfined host execution is strictly rejected by default (`ISOLATION_FAILED_CLOSED`). Development host execution requires explicit opt-in (`INTERVIEWOS_ALLOW_UNSAFE_HOST_EXECUTION=true`) and is visibly labeled as `UNCONFINED_HOST_DEV_ONLY`.
7. **Policy and Decision Plane**:
   - Deterministic rule synthesis separating Technical Result (`PASSED`, `FAILED`, `INCOMPLETE`) from Integrity State (`VERIFIED`, `REVIEW_CONDITION_RESOLVED`, `POLICY_BREACH_CONFIRMED`, `INCONCLUSIVE`).
   - Comprehensive quantitative benchmarking and audit reporting.

---

## 2. Quantitative Targets & Defensible Empirical Benchmarks

All benchmark results are measured empirically on real workloads. Synthetic 100% claims without sample sizes are eliminated.

| Benchmark Suite | Evaluated Workload | Primary Empirical Metric | Status | Defensibility Notes |
| :--- | :--- | :--- | :--- | :--- |
| **IOEP Merkle & Crypto** | 1,000 Event Leaves | 3.178 ms tree construction | **PASS** | RFC 9162 domain separation (0x00/0x01); 100% tamper detection |
| **Distributed Stream Recovery** | 1,200 Stream Messages | 100.0% unacked PEL recovery | **PASS** | XAUTOCLAIM worker crash recovery; 0 message loss |
| **Agent Policy & Anomaly** | 120 Scenarios (N=120) | F1: 1.0 (Recall: 100.0%) | **PASS** | Confusion matrix measured with 95% Wilson Score CIs: [94.0%, 100.0%] |
| **Technical Grading** | Multi-Problem Rubric | 100.0% rubric consistency | **PASS** | Evaluated on optimal, suboptimal, and syntax-erroneous code |
| **Local Speech Engine** | Real Dialogue (N=3) | Mean WER: 16.25% \| Mean CER: 5.34% | **PASS** | Piper-TTS (RTF: 1.214) + Faster-Whisper (RTF: 0.540) on CPU |
| **Local LLM Throughput** | Qwen 3B, Qwen 1.5B, Granite 3B | 55 - 78 tokens/sec on RTX 3050 | **PASS** | Peak VRAM 3.3 GB (< 4.0 GB VRAM limit); strict allowlist |

*Full empirical details, confusion matrices, and reproduction instructions are available in [docs/BENCHMARK_REPORT.md](docs/BENCHMARK_REPORT.md).*

---

## 3. Quickstart & Orchestration

### 3.1 Single-Command Setup & Launch (Windows PowerShell)

```powershell
# 1. Automated Local Setup (Python virtual environment, dependencies, model validation)
.\scripts\setup-local.ps1

# 2. Start All Local Services (Ollama, Local AI FastAPI :8000, Go Backend :8080)
.\scripts\start-local.ps1

# 3. Verify Health & GPU Hardware Metrics
.\scripts\verify-local.ps1

# 4. Run Master Empirical Benchmark Suite
.\scripts\benchmark-local-ai.ps1

# 5. Stop All Local Services
.\scripts\stop-local.ps1
```

### 3.2 Running the Test Suites

```powershell
# Go Backend Unit & Integration Tests (Store, Auth, API, Merkle, Network)
cd backend
go test -v ./...
cd ..

# Python Test Suite (Sandbox security fail-closed, Temporal workflows, Local AI hardening)
$env:PYTHONPATH = "."
.\venv\Scripts\python.exe -m pytest tests/test_sandbox_security.py tests/test_temporal_workflow.py tests/test_local_ai_hardening.py -v

# Multi-Agent Lifecycle Unit Tests
.\venv\Scripts\python.exe -m unittest agents/tests/test_agents.py

# End-to-End Master Acceptance Demo
.\venv\Scripts\python.exe scripts/demo_e2e.py

# Windows Native C++20 Endpoint Agent Test Suite
g++ -std=c++20 -Iagent/include agent/tests/test_agent.cpp -o agent_test.exe -lbcrypt -lsetupapi -lwtsapi32 -liphlpapi -lpsapi -lrpcrt4 -lws2_32 -lwinhttp -lbthprops
.\agent_test.exe
```

---

## 4. Security & Privacy Assurance Boundaries

1. **Endpoint Boundary**:
   - The native Windows agent operates in user mode (`Medium Integrity`). It provides high-fidelity observation and cryptographically authentic evidence, but cannot prevent hardware hypervisor compromise.
2. **Fail-Closed Sandbox Boundary**:
   - Candidate untrusted code execution mandates an isolated container boundary (`--network none`, `--read-only`, `--memory 128m`, non-root user).
   - If the container runtime is offline, execution fails closed unless explicitly overridden in developer environments.
3. **Privacy Boundary**:
   - Monitoring is restricted to process lifecycle events, connected peripherals, display topology, and network transitions. Keystrokes, audio eavesdropping outside turns, and personal file contents are never collected.
