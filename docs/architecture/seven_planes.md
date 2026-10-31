# The Seven-Plane Master Architecture of InterviewOS

InterviewOS partitions its systems engineering concerns across seven logical planes:

## Plane 1: Control and Integration
- **Role**: Organizational hierarchy, assessment lifecycle, policy compilation, session onboarding.
- **Components**: Go HTTP REST APIs (20 versioned endpoints), signed webhooks, OpenAPI contract.
- **Invariants**: Deterministic policy manifests are versioned immutably. Modifying policy parameters creates a new version increment and does not retroactively alter active assessments.

## Plane 2: Endpoint Trust Runtime
- **Role**: Native Windows 11 endpoint intelligence.
- **Implementation**: Real C++20 Win32 application leveraging SetupAPI, Toolhelp32/ETW, QueryDisplayConfig, WTSQuerySessionInformation, and IP Helper APIs.
- **Cryptography**: Windows CNG (BCrypt) ECDSA P-256 and SHA-256 with DPAPI/TPM key protection.
- **Persistence**: SQLite WAL-backed local evidence journal preserving sequential monotonic order through offline interruptions.

## Plane 3: Evidence and Data Infrastructure
- **Role**: High-throughput ingestion, cryptographic chain verification, and durable storage.
- **Implementation**: Go ingestion pipeline, canonical RFC 8785 JSON serialization, incremental hash chaining ($H_i = \text{SHA256}(\dots)$), RFC 9162 binary Merkle trees.
- **Persistence**: PostgreSQL repository with 32 schema tables, Transactional Outbox, and Redis Streams.

## Plane 4: Autonomous Orchestration
- **Role**: Multi-agent coordination and capability authorization.
- **Implementation**: Assessment Commander, Autonomy Guard, typed task contracts, Temporal durable workflows.
- **Enforcement**: Capability tokens strictly limit agent actions, enforcing tool call budgets and preventing unauthorized actions.

## Plane 5: Assessment Intelligence
- **Role**: Behavioral anomaly analysis, structural code forensics, multilingual interviewing, and adaptive challenge generation.
- **Components**:
  - `BehavioralInvestigator`: Hypothesis formation, missing evidence requests, loop prevention.
  - `CodeForensics`: AST normalization, variable renaming, token cosine similarity, JPlag structural baseline.
  - `MultilingualInterviewer`: English, Hindi, Hinglish speech/text processing with verbatim transcript preservation.
  - `AdaptiveChallenge`: Controlled code modifications and debugging challenges.
  - `SandboxedExecutionService`: Quota-constrained subprocess runner (CPU, memory, timeout limits).

## Plane 6: Policy and Decision
- **Role**: Deterministic rule synthesis and outcome finalization.
- **Core Decoupling**: Technical Score (`PASSED`, `FAILED`, `INCOMPLETE`) is strictly independent of Integrity State (`VERIFIED`, `REVIEW_CONDITION_RESOLVED`, `POLICY_BREACH_CONFIRMED`, `INCONCLUSIVE`, `SESSION_INCOMPLETE`).
- **Zero Probabilistic Convictions**: A statistical anomaly never automatically fails a candidate without verified deterministic breach evidence.

## Plane 7: Governance and Observability
- **Role**: Security audit, candidate privacy guarantees, OpenTelemetry metrics, and synthetic benchmark laboratory.
- **Verification**: Benchmark suite testing against ground truth across adversarial scenarios.

