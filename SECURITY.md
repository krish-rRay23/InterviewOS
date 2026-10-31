# Security Policy: InterviewOS

## 1. Security Architecture & Threat Model

InterviewOS is designed under zero-trust assumptions regarding endpoints and autonomous agents:

### 1.1 Endpoint Non-Assumptions
- A valid cryptographic signature attests to event origin and immutability under the enrolled session key.
- A valid signature does **NOT** prove that the underlying operating system is free of root compromise, hypervisor virtualization, or external physical assistance.
- Endpoint collectors enforce least-privilege telemetry: no keylogging, no arbitrary file scanning, no memory scraping.

### 1.2 Multi-Agent Security & Autonomy Guard
- Autonomous agents operate exclusively through capability-authorized tokens.
- **Forbidden Operations**: No LLM agent is permitted to execute arbitrary shell commands, delete raw evidence, modify assessment policies, terminate arbitrary OS processes, or access cross-session data.
- Tool call budgets and session timeouts are deterministically enforced.

### 1.3 Cryptographic Protocols (IOEP)
- Session signing keys are protected via Windows CNG / DPAPI, binding to TPM 2.0 when available.
- Incremental hash chains ($H_i$) prevent event drop, reordering, or alteration.
- Batch checkpoints use binary Merkle trees compliant with RFC 9162.

---

## 2. Reporting a Vulnerability

If you discover a security vulnerability or bypass within InterviewOS, please report it privately:
- **Email**: security@interviewos.dev
- Include reproduction steps, environment details, and proof of concept.
- Please allow 48 hours for an acknowledgment prior to public disclosure.
