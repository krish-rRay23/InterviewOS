# Product Direction & Architecture Identity

## 1. True Product Positioning

**InterviewOS** is an **Evidence-First Autonomous Technical Assessment Platform with a Native Endpoint Trust Runtime**.

It is explicitly **NOT**:
- A generic AI coding assistant (like GitHub Copilot or Cursor).
- A conventional ATS (Applicant Tracking System) or recruitment marketplace.
- Merely an AI interviewer or chatbot wrapper.
- A basic video-proctoring dashboard relying on webcam eye-tracking heuristics.
- A collection of superficial separately named agents performing hardcoded handoffs.
- An actual replacement operating system or kernel-mode driver product.

---

## 2. Core Workflow & Architectural Loop

The platform executes a strict, verifiable operational lifecycle:

```
┌─────────────┐       ┌────────────────────────┐       ┌─────────────────┐
│   OBSERVE   │  ───> │ PRESERVE EVIDENCE (WAL)│  ───> │   INVESTIGATE   │
└─────────────┘       └────────────────────────┘       └─────────────────┘
                                                                │
                                                                ▼
┌─────────────┐       ┌────────────────────────┐       ┌─────────────────┐
│   REPORT    │  <─── │        EVALUATE        │  <─── │    CHALLENGE    │
└─────────────┘       └────────────────────────┘       └─────────────────┘
```

1. **Observe**: Transparent, consent-based endpoint observations (process lifecycle, display configuration, connected peripherals, remote session status, network adapter state).
2. **Preserve Evidence**: Cryptographic journal logging using local SQLite WAL, RFC 9162 Merkle tree checkpoints, ECDSA P-256 signatures, and monotonic sequence counters.
3. **Investigate**: Multi-source behavioral anomaly correlation using authorized capability tokens, hypothesis generation, and explicit evidence corroboration.
4. **Challenge**: Adaptive conversational follow-ups and algorithmic probing to verify genuine candidate comprehension vs rote memorization or external assistance.
5. **Evaluate**: Strict decoupling of technical competency scoring from integrity proctoring findings.
6. **Report**: Comprehensive, auditable assessment reports providing transparent provenance from raw endpoint event to final recommendation.

---

## 3. Competitive Differentiation & Honest Boundaries

### Commercial Landscape Context (HackerRank Chakra, ASTRA, AI Fluency, MOSS)
- Autonomous coding interviews, adaptive follow-ups, execution sandboxes, and lexical/AST similarity detection (JPlag, MOSS) are standard commercial features.
- InterviewOS **does not** claim that autonomous interviewing or code evaluation are unique inventions.

### True Technical Differentiation
InterviewOS differentiates on the synthesis of 5 core principles:
1. **Verifiable Endpoint Evidence with Explicit Assurance Limitations**: Endpoint observations are cryptographically sealed and authenticated. We openly acknowledge that user-mode monitoring cannot guarantee kernel-level tamper resistance against physical compromise or rootkits.
2. **Autonomous, Multi-Source, Policy-Aware Investigation**: Anomaly detection correlates process activity, display topology (e.g. mirrored displays), and network connections rather than making snap accusations from isolated blips.
3. **Auditable Evidence Chain**: Every finding is backed by an immutable hash-chain connecting raw observations to investigative actions and outcomes.
4. **Consistent Multilingual Technical Evaluation**: Verbatim transcript preservation across English, Hindi, and Hinglish with conceptual parity mapping.
5. **Durable Orchestration & Replay Recovery**: Temporal-backed workflow execution guaranteeing state recovery across process and network interruptions.

---

## 4. Governance & Human Oversight Principles

- **Zero Unilateral Accusations**: Autonomous actions are strictly bounded by organization-defined policy tokens.
- **Defensive Inconclusive Handling**: If evidence is ambiguous, partial, or missing, the system emits an `INCONCLUSIVE` classification rather than issuing a false accusation.
- **Human-in-the-Loop Governance**: High-impact employment and disciplinary decisions require human review. Technical scores and integrity ratings remain strictly separated.
