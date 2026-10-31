# Threat Model & OWASP Agentic Security (2026)

## 1. Overview
InterviewOS operates in high-stakes technical assessment environments. The security posture addresses two primary attack surfaces:
1. **Candidate Endpoint Attacks**: Tampering with telemetry, replay attacks, forged signatures, covert remote assistance.
2. **Autonomous Multi-Agent Attacks**: Prompt injection, privilege escalation, unauthorized tool calls, budget depletion.

---

## 2. OWASP Top 10 for Agentic Applications Mapping

| OWASP Vulnerability | Risk Scenario | InterviewOS Mitigation |
|---|---|---|
| **ASI-01: Unauthorized Tool Execution** | LLM agent attempts shell execution or process killing. | **Autonomy Guard**: Deterministic capability token check on every single tool call. Forbidden operations blocked at kernel gate. |
| **ASI-02: Prompt Injection / Hijack** | Candidate embeds hidden prompt in code to force agent to approve session. | **Structural Isolation**: Model conclusions are advisory; deterministic policy engine decides final outcomes based on verified event IDs. |
| **ASI-03: Excessive Agency / Unbounded Loops** | Agent repeatedly queries telemetry, consuming unbounded budget. | **Investigation Planner**: Fixed tool-call budget per token ($N \le 10$), case deduplication cache, loop prevention. |
| **ASI-04: Insecure Output Handling** | Agent generates unvalidated data for backend. | **Typed Schema Contracts**: All agent communications adhere to strict JSON Schema contracts with Pydantic/Go validation. |
| **ASI-05: Cross-Session Data Leakage** | Agent queries another candidate's evidence. | **Tenant Isolation**: Capability tokens are cryptographically bound to specific `session_id`. Cross-session queries rejected. |

---

## 3. Cryptographic Attack Mitigations

### 3.1 Event Tampering
- **Attack**: Candidate intercepts network traffic and modifies a `PROCESS_STARTED: anydesk.exe` event to `code.exe`.
- **Defense**: Modifying the payload invalidates the incremental SHA-256 hash $H_i$, breaks the Merkle tree root $R$, and causes the ECDSA P-256 checkpoint signature to fail verification. The backend rejects the batch with HTTP 422 `HASH_CHAIN_BROKEN`.

### 3.2 Replay Attacks
- **Attack**: Candidate records a prior clean session's signed batches and replays them in a new session.
- **Defense**: Every batch checkpoint incorporates the unique `session_id` and strict monotonic sequence watermarks ($Seq_{start} = Seq_{prev} + 1$). Replayed batches fail session key binding and sequence continuity checks.

### 3.3 Endpoint Compromise Non-Assumptions
- **Disclosure**: A valid signature proves the enrolled session key produced the batch. It does **NOT** prove the absence of ring-0 rootkits, hypervisor interception, or physical second-screen devices. InterviewOS explicitly logs assurance state as `SOFTWARE_CNG_DPAPI` or `HARDWARE_TPM` and does not claim impossible universal omniscience.
