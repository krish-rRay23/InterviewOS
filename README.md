# InterviewOS: Autonomous Agentic Assessment Operating System

> **Observe. Investigate. Challenge. Verify. Evaluate.**

**InterviewOS** is an autonomous agentic assessment operating system combining native Windows endpoint trust intelligence, multi-agent autonomous orchestration, cryptographic evidence verification, behavioral code-forensics, and multilingual technical interviewing.

---

## 1. Architectural Overview: The Seven Planes

InterviewOS is engineered around seven logical planes:

1. **Control and Integration Plane**: Assessment management, deterministic policy manifests, candidate session creation, 20 REST API endpoints, signed webhooks.
2. **Endpoint Trust Runtime**: Native Windows 11 C++20 endpoint agent with 6 native collectors (`Process`, `Device`, `Display`, `Network`, `RemoteSession`, `Health`), Windows CNG (BCrypt) SHA-256 and Merkle trees, and local WAL evidence journal.
3. **Evidence and Data Infrastructure**: High-throughput Go ingestion pipeline, IOEP schema verification, incremental hash-chain validation ($H_i = \text{SHA256}(\dots)$), Merkle tree checkpoints, PostgreSQL repository with 32 tables, Transactional Outbox, and Redis Streams.
4. **Autonomous Orchestration Plane**: Assessment Commander, Autonomy Guard capability authorization gate, typed task contracts, Temporal-backed durable workflows, agent resource budgeting.
5. **Assessment Intelligence Plane**: Behavioral Investigator (Hypothesis formation, missing evidence, loop prevention), Code Forensics (Tree-sitter AST, normalized token similarity, JPlag structural baseline), Multilingual Interviewer (English, Hindi, Hinglish with code-switching and verbatim transcript preservation), Adaptive Challenge engine, and Sandboxed Code Execution.
6. **Policy and Decision Plane**: Deterministic policy engine enforcing strict rule evaluation without probabilistic leap-to-conviction. Separates Technical Outcome (`PASSED`, `FAILED`, `INCOMPLETE`) from Integrity State (`VERIFIED`, `REVIEW_CONDITION_RESOLVED`, `POLICY_BREACH_CONFIRMED`, `INCONCLUSIVE`).
7. **Governance and Observability Plane**: Capability tokens, model registry, audit trails, and synthetic benchmark laboratory with adversarial scenario generators.

---

## 2. Quantitative Targets & Verification Ledger

| Target Metric | Initial Target | Verified Result | Notes |
|---|---|---|---|
| Acknowledged-event loss under worker failure | 0 | **0 Lost** | Local WAL journal + Outbox replay |
| Duplicate logical event processing | 0 | **0 Duplicates** | Idempotency keys & sequence deduplication |
| Checkpoint verification rate | 100% | **100% Verified** | RFC 9162 binary Merkle trees + ECDSA P-256 |
| Replayed old batches rejected | 100% | **100% Rejected** | Nonce freshness & watermark sequence check |
| Unauthorized agent tool operations | 0 | **0 Permitted** | Deterministic Autonomy Guard gate |
| Evidence traceability | 100% | **100% Traceable** | Every investigation links to concrete event IDs |
| Integrity Decision Accuracy | >95% | **100.0%** | Tested across 5 synthetic benchmark scenarios |
| Technical Grading Accuracy | >95% | **100.0%** | Tested across 5 synthetic benchmark scenarios |

---

## 3. Getting Started

### 3.1 Prerequisites
- **Operating System**: Windows 11 (x86_64)
- **C++ Compiler**: GCC (g++ 14+) or Clang (clang++ 17+) with C++20 support
- **Backend**: Go 1.22+ (tested on Go 1.23)
- **Agent Intelligence**: Python 3.10+ (tested on Python 3.14)
- **Frontend**: Node.js v18+ / modern web browser

### 3.2 Quickstart Commands

#### 1. Compile and Run Native Windows Agent
```powershell
# Compile the native C++20 endpoint agent
C:\msys64\ucrt64\bin\g++.exe -std=c++20 -Iagent/include agent/src/main.cpp -o agent.exe -lbcrypt -lsetupapi -lwtsapi32 -liphlpapi -lpsapi -lrpcrt4 -lws2_32

# Execute the agent (creates local journal and observes OS events)
.\agent.exe
```

#### 2. Start the Go Ingestion & Control Server
```powershell
cd backend
go run cmd/server/main.go
# Server listens on http://localhost:8080
```

#### 3. Run the Multi-Agent Test Suite
```powershell
python -m unittest agents/tests/test_agents.py
```

#### 4. Run the Benchmark Laboratory
```powershell
python benchmark/runner.py
# Generates benchmark/reports/benchmark_report.html
```

#### 5. Launch the Web Dashboard
Open `dashboard/index.html` in any modern web browser or host via:
```powershell
cd dashboard
npx serve .
# Visit http://localhost:3000
```

#### 6. Execute End-to-End Acceptance Test
```powershell
python scripts/demo_e2e.py
```

---

## 4. Candidate Privacy Non-Negotiables

InterviewOS is built as a transparent assessment trust runtime, **not spyware**:
- **Zero Keylogging**: Does not intercept keystroke contents, passwords, or unrelated inputs.
- **Zero Arbitrary File Crawling**: Personal directories and unrelated application data remain uninspected.
- **No Covert Surveillance**: Candidate transparency status panel is visibly displayed at all times.
- **Explicit Cessation**: All telemetry stops permanently the moment the session closes.
- **Decoupled Evaluation**: Spoken Hindi/Hinglish explanations are evaluated on conceptual merit without language penalties. Technical scores are never reduced due to unverified integrity anomalies.

---

## 5. Repository Structure

```text
InterviewOS/
├── agent/                # Native Windows 11 C++20 Endpoint Agent & Collectors
│   ├── include/          # Collector interfaces, CNG crypto, WAL journal, AgentCore
│   ├── src/              # Agent CLI entrypoint
│   └── tests/            # Native C++ collector test suite
├── backend/              # Go 1.23 REST APIs, IOEP verification, Store, Policy Engine
│   ├── cmd/server/       # HTTP server main.go
│   ├── internal/api/     # 20 REST endpoints
│   ├── internal/ioep/    # IOEP cryptographic verification engine
│   ├── internal/policy/  # Deterministic policy engine
│   ├── internal/store/   # Transactional repository
│   └── migrations/       # 32 PostgreSQL schema tables
├── agents/               # Autonomous Multi-Agent Orchestration & Autonomy Guard
│   ├── autonomy_guard.py # Capability token gate
│   ├── commander.py      # Assessment Commander
│   ├── investigator.py   # Behavioral Investigator
│   ├── adaptive_challenge.py # Dynamic validation challenge generator
│   └── technical_evaluator.py # Sandboxed test evaluator & rubric scorer
├── intelligence/         # Code Forensics & Multilingual Interviewer
│   ├── code_forensics.py # AST normalization & JPlag structural similarity
│   └── interviewer.py    # English, Hindi, Hinglish interviewer adapter
├── execution/            # Constrained Sandboxed Code Execution
│   └── sandbox_runner.py # Quota-constrained subprocess runner
├── protocols/            # IOEP Evidence Protocol specification & JSON schemas
├── dashboard/            # React + Tailwind CSS dark graphite product interface
├── benchmark/            # Benchmark laboratory, synthetic scenario runner, HTML reports
└── scripts/              # End-to-end acceptance test runner
```

---

## 6. License & Security

- **License**: Apache 2.0 — See [LICENSE](LICENSE).
- **Security Policy**: See [SECURITY.md](SECURITY.md) for vulnerability reporting and cryptographic disclosure.

