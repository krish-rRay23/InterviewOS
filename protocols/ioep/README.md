# IOEP — InterviewOS Evidence Protocol Specification (Version 1.0)

## 1. Abstract & Standards Alignment

The **InterviewOS Evidence Protocol (IOEP)** is an asymmetric, verifiable telemetry and integrity protocol designed for endpoint trust during high-stakes technical assessments.
IOEP is grounded in established RFC and W3C standards:
- **RFC 9334**: Remote Attestation Procedures Architecture (RATS) — Verifier, Attester, Relying Party roles.
- **RFC 9711**: Entity Attestation Token (EAT) — Cryptographic claims envelope.
- **RFC 9162**: Certificate Transparency Version 2.0 — Merkle-based verifiable append-only logs.
- **W3C PROV-DM**: Provenance Data Model for auditable event attribution and chain of custody.

---

## 2. Cryptographic Protocol Primitives

### 2.1 Keys & Enrollment
1. At session initialization, the client generates an asymmetric key pair (NIST P-256 / secp256r1 or Ed25519; default: ECDSA P-256).
2. The private key is secured via Windows CNG / DPAPI with `NCRYPT_SILENT_FLAG`, utilizing the Microsoft Platform Crypto Provider (TPM 2.0) when available, or software-protected CNG storage as an explicit lower-assurance fallback.
3. The server generates a high-entropy 256-bit cryptographic challenge nonce ($N_s$).
4. The client signs the challenge nonce alongside the session enrollment parameters ($SessionId, CandidateId, Timestamp, ClientNonce$) and returns the public key and signature to the backend.
5. The backend validates the challenge signature, binds the public key to the session in PostgreSQL, and issues an enrollment receipt.

### 2.2 Canonical Serialization
All event hashing and signature verification must use deterministic JSON serialization:
- Keys sorted lexicographically (Unicode codepoint order).
- No extraneous whitespace between tokens (`:`, `,`).
- UTF-8 encoding.
- Floats represented without trailing zeroes or exponent quirks.

### 2.3 Incremental Hash Chain
Every event $e_i$ ($i \ge 1$) forms a hash chain:
$$H_0 = \text{SHA-256}(\text{"IOEP-CHAIN-GENESIS:"} \parallel SessionId)$$
$$H_i = \text{SHA-256}(\text{"IOEP-EVENT-V1:"} \parallel SessionId \parallel i \parallel H_{i-1} \parallel \text{Canonical}(e_i.\text{payload}))$$

This guarantees forward-integrity: modifying or dropping any intermediate event invalidates all subsequent hashes.

### 2.4 Merkle Tree Checkpoints
Batches of events $[e_k, e_{k+1}, \dots, e_m]$ are aggregated into a binary Merkle tree:
- Leaf hash: $L_j = \text{SHA-256}(0x00 \parallel H_j)$
- Interior node hash: $M = \text{SHA-256}(0x01 \parallel M_{left} \parallel M_{right})$
- The Merkle root $R_{batch}$ represents the entire batch.
- The client signs $R_{batch}$ alongside batch metadata:
  $$\text{CheckpointSig} = \text{Sign}_{PrivKey}(\text{"IOEP-CHECKPOINT-V1:"} \parallel SessionId \parallel k \parallel m \parallel R_{batch} \parallel \text{PrevBatchHash})$$

### 2.5 Trust State Invariants
1. **Signature Validity**: Validates that the payload was authorized by the enrolled session key.
2. **Hash-Chain Continuity**: Sequence numbers must be strictly monotonic ($i = i-1 + 1$) without gaps or unexpected forks.
3. **Hardware Assurance**: Hardware-backed (TPM) vs Software-protected CNG keys are explicitly tagged and tracked.
4. **Replay Rejection**: Checkpoints containing previously acknowledged sequences or expired nonces are rejected.
5. **Independence of Guarantees**: A valid cryptographic signature attests to event origin and immutability; it does NOT imply the host OS is free of root compromises or physical tampering.

