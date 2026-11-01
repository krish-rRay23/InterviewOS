# Architectural Gap Audit & Threat Model Analysis

**Audit Date**: 2026-11-01  
**Scope**: Native Windows Agent, Cryptography, Distributed Infrastructure, Agent Orchestration, Sandbox Execution, and Privacy Guarantees.

---

## 1. Native Windows Endpoint Runtime Plane

### Strengths
- C++20 implementation utilizing native Win32 APIs: `CreateToolhelp32Snapshot`, `SetupDiGetClassDevsW`, `EnumDisplayMonitors`, `QueryDisplayConfig`, `GetAdaptersAddresses`, `WTSQuerySessionInformationW`.
- Hardware-backed cryptography interfaces via Windows CNG (`BCryptOpenAlgorithmProvider`, `BCryptCreateHash`).
- Local evidence buffering using transactional SQLite WAL journaling (`journal_wal.hpp`).

### Verified Gaps & Engineering Realities
1. **Polling vs. True Event-Driven Monitoring**:
   - The native collectors in `AgentCore` rely on a 500ms observation loop polling snapshots (`TakeSnapshot()`), rather than asynchronous ETW (Event Tracing for Windows) kernel subscriptions or Win32 hook notifications.
   - **Correction**: Accurately document collectors as *Periodic Snapshot Reconciliation (500ms polling interval)* with sequence gaps and event-loss detection. User-mode polling has a window of up to 500ms where short-lived ephemeral processes (<500ms) could spawn and exit unobserved.
2. **User-Mode Assurance Limitations**:
   - The agent runs in user-mode (`Medium Integrity` level).
   - Any software running in user-mode can be terminated, suspended, or hooked by an administrator or rootkit running on the same host.
   - **Correction**: Disclose that user-mode endpoint monitoring provides **high-fidelity observation and evidence authentication**, but cannot provide kernel-level tamper resistance against compromised hosts.

---

## 2. Evidence Infrastructure & Cryptography Plane

### Strengths
- IOEP batch checkpoints enforce RFC 9162 Merkle tree construction with distinct domain separation prefixes (`0x00` leaf, `0x01` internal node).
- Canonical JSON serialization enforces alphabetical key sorting and deterministic formatting prior to hashing.
- Hash-chain monotonicity ensures that deletions or reordering within a session break the hash chain.

### Verified Gaps
1. **Evidence Authenticity vs. Endpoint Truth**:
   - Cryptographic signatures prove that *the enrolled key on the client signed the message*. They do not prove that *the physical human in front of the screen spoke the truth*.
   - If an endpoint OS is compromised or running inside an unconstrained virtual machine, valid signatures can be generated over falsified telemetry.
   - **Correction**: Decouple cryptographic provenance from epistemological certainty.

---

## 3. Sandboxed Code Execution Plane

### Strengths
- `SandboxedExecutionService` in `execution/sandbox_runner.py` creates isolated temporary directories and executes code using explicit argument lists without `shell=True`.
- Enforces strict process timeouts (`timeout=3.0s`).

### Verified Gaps
1. **Host-Level Process Sandbox Isolation**:
   - On Windows, `subprocess.run(["python", script_path])` runs directly in the host OS user context. While executed in a temporary working directory with a timeout, it is not placed inside a restricted Windows Job Object, AppContainer, or isolated Docker container.
   - Malicious candidate code could theoretically attempt network calls or inspect the host filesystem if not restricted by a sandbox hypervisor.
   - **Correction**: Harden execution timeouts, inspect untrusted code for prohibited standard library modules (`os.system`, `subprocess`, `socket`), and explicitly document the threat model boundaries.

---

## 4. Autonomous Agent Ecosystem

### Strengths
- `AutonomyGuard` cleanly intercepts agent operations, verifies capability tokens, and enforces loop detection ($< 5$ identical actions).
- `AssessmentCommanderAgent` coordinates the multi-stage lifecycle and isolates technical grading from behavioral proctoring flags.

### Verified Gaps
1. **Agent Sprawl & Redundancy**:
   - Having separate classes for `DeviceIntelligence`, `NetworkIntelligence`, and `EndpointIntelligence` when they all route through simple heuristic lookups adds cognitive overhead without added capabilities.
   - **Correction**: Consolidate evidence evaluation under the `BehavioralInvestigatorAgent` with specialized analyzers for process, display, and network domains.
