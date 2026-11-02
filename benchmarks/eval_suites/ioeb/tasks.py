"""
InterviewOS Engineering Benchmark (IOEB) - Task Catalog (Section 2.A).
Inspired by HackerRank-Bench evaluation principles.
Long-horizon, complete-system engineering assignments evaluated on observable software behavior.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Callable, Any


@dataclass
class IOEBTask:
    task_id: str
    category: str
    title: str
    description: str
    behavioral_contract: str
    test_cases: List[Dict[str, Any]]  # name, input, expected, weight
    reference_code: str
    broken_code: str
    mutated_code: str  # Code with subtle defects to test partial scoring


IOEB_TASKS: List[IOEBTask] = [
    IOEBTask(
        task_id="IOEB-01-RATELIMITER",
        category="Distributed Systems",
        title="Sliding-Window Distributed Rate Limiter",
        description="Implement a thread-safe sliding-window rate limiter tracking requests per client ID over a time window.",
        behavioral_contract="Enforces max_requests within window_seconds. Cleans expired timestamps. Returns (allowed: bool, retry_after: float).",
        test_cases=[
            {"name": "Allow under limit", "weight": 25, "tokens": 5, "window": 10, "reqs": 4, "expected_allowed": 4},
            {"name": "Reject on threshold", "weight": 25, "tokens": 3, "window": 10, "reqs": 5, "expected_allowed": 3},
            {"name": "Window sliding expiry", "weight": 25, "tokens": 2, "window": 1, "reqs": 4, "wait": 1.1, "expected_allowed": 4},
            {"name": "Per-client isolation", "weight": 25, "tokens": 2, "window": 10, "clients": ["c1", "c2"], "expected_allowed": 4},
        ],
        reference_code="""
import time
from collections import deque

class RateLimiter:
    def __init__(self, max_requests, window_seconds):
        self.max = max_requests
        self.window = window_seconds
        self.clients = {}

    def allow(self, client_id):
        now = time.time()
        if client_id not in self.clients:
            self.clients[client_id] = deque()
        q = self.clients[client_id]
        while q and q[0] <= now - self.window:
            q.popleft()
        if len(q) < self.max:
            q.append(now)
            return True, 0.0
        retry_after = (q[0] + self.window) - now
        return False, max(0.0, retry_after)
""",
        broken_code="""
class RateLimiter:
    def __init__(self, max_requests, window_seconds):
        pass
    def allow(self, client_id):
        return False, 10.0
""",
        mutated_code="""
# Mutated: lacks per-client isolation (shares single queue across all clients)
import time
from collections import deque

class RateLimiter:
    def __init__(self, max_requests, window_seconds):
        self.max = max_requests
        self.window = window_seconds
        self.global_q = deque()

    def allow(self, client_id):
        now = time.time()
        while self.global_q and self.global_q[0] <= now - self.window:
            self.global_q.popleft()
        if len(self.global_q) < self.max:
            self.global_q.append(now)
            return True, 0.0
        return False, 5.0
"""
    ),

    IOEBTask(
        task_id="IOEB-02-JWT-JWKS",
        category="Identity & Auth",
        title="Asymmetric Token Validator with JWKS Key Cache",
        description="Verify cryptographic signature, expiration, issuer, and audience against public JWKS keys with TTL caching.",
        behavioral_contract="Verifies RSA/ECDSA signature, validates exp, nbf, iss, aud claims, and refreshes JWKS cache on unknown kid.",
        test_cases=[
            {"name": "Valid token signature and claims", "weight": 30},
            {"name": "Reject expired token", "weight": 25},
            {"name": "Reject issuer mismatch", "weight": 25},
            {"name": "Cache JWKS key lookups", "weight": 20},
        ],
        reference_code="""
import hmac, hashlib, base64, json, time

class TokenValidator:
    def __init__(self, expected_iss, expected_aud):
        self.iss = expected_iss
        self.aud = expected_aud
        self.keys = {"k1": "secret-key-1"}

    def validate(self, token):
        try:
            parts = token.split(".")
            if len(parts) != 3: return False, "malformed"
            header = json.loads(base64.urlsafe_b64decode(parts[0] + "=="))
            payload = json.loads(base64.urlsafe_b64decode(parts[1] + "=="))
            sig = parts[2]
            kid = header.get("kid", "k1")
            key = self.keys.get(kid)
            if not key: return False, "unknown_key"
            expected_sig = hmac.new(key.encode(), f"{parts[0]}.{parts[1]}".encode(), hashlib.sha256).hexdigest()
            if sig != expected_sig: return False, "invalid_signature"
            now = time.time()
            if payload.get("exp", 0) < now: return False, "expired"
            if payload.get("iss") != self.iss: return False, "invalid_issuer"
            if payload.get("aud") != self.aud: return False, "invalid_audience"
            return True, "valid"
        except Exception as e:
            return False, str(e)
""",
        broken_code="""
class TokenValidator:
    def __init__(self, iss, aud): pass
    def validate(self, token): return False, "unimplemented"
""",
        mutated_code="""
# Mutated: checks signature but forgets to check expiration claim
import hmac, hashlib, base64, json

class TokenValidator:
    def __init__(self, expected_iss, expected_aud):
        self.iss = expected_iss
        self.aud = expected_aud
        self.keys = {"k1": "secret-key-1"}

    def validate(self, token):
        parts = token.split(".")
        header = json.loads(base64.urlsafe_b64decode(parts[0] + "=="))
        payload = json.loads(base64.urlsafe_b64decode(parts[1] + "=="))
        sig = parts[2]
        key = self.keys.get(header.get("kid", "k1"), "")
        expected_sig = hmac.new(key.encode(), f"{parts[0]}.{parts[1]}".encode(), hashlib.sha256).hexdigest()
        if sig != expected_sig: return False, "invalid_signature"
        if payload.get("iss") != self.iss: return False, "invalid_issuer"
        # Bug: exp check omitted
        return True, "valid"
"""
    ),

    IOEBTask(
        task_id="IOEB-03-MULTITENANT-RLS",
        category="Security & Isolation",
        title="Multi-Tenant Row-Level Security & AST Query Rewriter",
        description="Inspect SQL/dict query AST and rewrite predicates to enforce tenant_id isolation without sql-injection leaks.",
        behavioral_contract="Automatically injects tenant_id = :active_tenant to all WHERE clauses, prevents cross-tenant access.",
        test_cases=[
            {"name": "Inject tenant filter on SELECT", "weight": 35},
            {"name": "Prevent tenant override via input", "weight": 35},
            {"name": "Handle multi-table JOIN tenant scoping", "weight": 30},
        ],
        reference_code="""
class TenantQueryRewriter:
    def __init__(self, tenant_id):
        self.tenant_id = tenant_id

    def rewrite_filter(self, query_dict):
        # Enforce tenant isolation strictly
        rewritten = dict(query_dict)
        rewritten["tenant_id"] = self.tenant_id
        return rewritten

    def authorize_read(self, record):
        return record.get("tenant_id") == self.tenant_id
""",
        broken_code="""
class TenantQueryRewriter:
    def __init__(self, t): pass
    def rewrite_filter(self, q): return q
    def authorize_read(self, r): return False
""",
        mutated_code="""
class TenantQueryRewriter:
    def __init__(self, tenant_id):
        self.tenant_id = tenant_id
    def rewrite_filter(self, query_dict):
        # Mutated: if tenant_id already provided in query, allows client override!
        if "tenant_id" in query_dict:
            return query_dict
        q = dict(query_dict)
        q["tenant_id"] = self.tenant_id
        return q
    def authorize_read(self, record):
        return True
"""
    ),

    IOEBTask(
        task_id="IOEB-04-OUTBOX-DEDUPE",
        category="Distributed Systems",
        title="Transactional Outbox & Exactly-Once Ingestion Deduplication",
        description="Idempotent consumer processing outbox events, maintaining deduplication watermark window, and routing poison messages to dead-letter queue.",
        behavioral_contract="Processes events idempotently based on idempotency_key, moves messages with >3 errors to DLQ, advances watermark.",
        test_cases=[
            {"name": "Process fresh events in order", "weight": 30},
            {"name": "Reject duplicate idempotency keys", "weight": 35},
            {"name": "Dead-letter queue on poison message", "weight": 35},
        ],
        reference_code="""
class OutboxProcessor:
    def __init__(self):
        self.processed = set()
        self.dead_letter_queue = []
        self.success_log = []

    def handle(self, event):
        key = event.get("idempotency_key")
        if key in self.processed:
            return "DUPLICATE_IGNORED"
        retries = event.get("retry_count", 0)
        if retries >= 3 or event.get("is_poison"):
            self.dead_letter_queue.append(event)
            return "ROUTED_TO_DLQ"
        self.processed.add(key)
        self.success_log.append(event)
        return "COMMITTED"
""",
        broken_code="""
class OutboxProcessor:
    def handle(self, e): return "FAILED"
""",
        mutated_code="""
# Mutated: commits duplicate events instead of dropping them
class OutboxProcessor:
    def __init__(self):
        self.dead_letter_queue = []
        self.success_log = []
    def handle(self, event):
        if event.get("is_poison"):
            self.dead_letter_queue.append(event)
            return "ROUTED_TO_DLQ"
        self.success_log.append(event)
        return "COMMITTED"
"""
    ),

    IOEBTask(
        task_id="IOEB-05-CIRCUIT-BREAKER",
        category="Distributed Systems",
        title="Resilient Circuit Breaker with Exponential Jitter Backoff",
        description="Three-state circuit breaker (CLOSED, OPEN, HALF_OPEN) with failure thresholds, recovery timeout, and randomized jitter.",
        behavioral_contract="Trips to OPEN upon consecutive failure threshold, waits recovery_timeout, probes in HALF_OPEN, resumes CLOSED on success.",
        test_cases=[
            {"name": "Normal execution under CLOSED", "weight": 25},
            {"name": "Trip to OPEN on 3 consecutive failures", "weight": 30},
            {"name": "Fast fail during OPEN without network call", "weight": 25},
            {"name": "Transition to HALF_OPEN and recover", "weight": 20},
        ],
        reference_code="""
import time

class CircuitBreaker:
    def __init__(self, failure_threshold=3, recovery_time=1.0):
        self.threshold = failure_threshold
        self.recovery_time = recovery_time
        self.state = "CLOSED"
        self.failures = 0
        self.last_failure_time = 0

    def call(self, func, *args, **kwargs):
        now = time.time()
        if self.state == "OPEN":
            if now - self.last_failure_time > self.recovery_time:
                self.state = "HALF_OPEN"
            else:
                return False, "CIRCUIT_OPEN_FAST_FAIL"
        try:
            res = func(*args, **kwargs)
            if self.state == "HALF_OPEN":
                self.state = "CLOSED"
                self.failures = 0
            return True, res
        except Exception as e:
            self.failures += 1
            self.last_failure_time = now
            if self.failures >= self.threshold or self.state == "HALF_OPEN":
                self.state = "OPEN"
            return False, str(e)
""",
        broken_code="""
class CircuitBreaker:
    def call(self, f): return False, "unimplemented"
""",
        mutated_code="""
# Mutated: never transitions to HALF_OPEN to recover once OPEN
import time
class CircuitBreaker:
    def __init__(self, failure_threshold=3, recovery_time=1.0):
        self.threshold = failure_threshold
        self.state = "CLOSED"
        self.failures = 0
    def call(self, func, *args, **kwargs):
        if self.state == "OPEN": return False, "CIRCUIT_OPEN_FAST_FAIL"
        try:
            return True, func(*args, **kwargs)
        except:
            self.failures += 1
            if self.failures >= self.threshold: self.state = "OPEN"
            return False, "failed"
"""
    ),

    IOEBTask(
        task_id="IOEB-06-IDEMPOTENT-LEASE",
        category="Distributed Systems",
        title="Distributed Idempotency Gate with Atomic Lease Locks",
        description="Atomic lease locking mechanism supporting fencing tokens, TTL expiration, and lock renewal.",
        behavioral_contract="Acquires atomic lock with monotonic fencing token, prevents split-brain writes, releases lock cleanly.",
        test_cases=[
            {"name": "Acquire lock and obtain fencing token", "weight": 35},
            {"name": "Prevent concurrent lease collision", "weight": 35},
            {"name": "Lease expiry releases lock", "weight": 30},
        ],
        reference_code="""
import time

class LeaseManager:
    def __init__(self):
        self.locks = {}
        self.token_counter = 0

    def acquire(self, resource_id, ttl_seconds):
        now = time.time()
        if resource_id in self.locks:
            holder, expiry, token = self.locks[resource_id]
            if now < expiry:
                return False, 0
        self.token_counter += 1
        self.locks[resource_id] = ("holder", now + ttl_seconds, self.token_counter)
        return True, self.token_counter

    def release(self, resource_id, token):
        if resource_id in self.locks:
            _, _, cur_token = self.locks[resource_id]
            if cur_token == token:
                del self.locks[resource_id]
                return True
        return False
""",
        broken_code="""
class LeaseManager:
    def acquire(self, r, t): return False, 0
    def release(self, r, t): return False
""",
        mutated_code="""
# Mutated: acquires lock and returns valid token, but does not auto-expire after TTL!
import time
class LeaseManager:
    def __init__(self):
        self.locks = {}
        self.token_counter = 0
    def acquire(self, resource_id, ttl_seconds):
        if resource_id in self.locks:
            return False, 0
        self.token_counter += 1
        self.locks[resource_id] = ("holder", float("inf"), self.token_counter)
        return True, self.token_counter
    def release(self, resource_id, token):
        if resource_id in self.locks:
            del self.locks[resource_id]
            return True
        return False
"""
    ),

    IOEBTask(
        task_id="IOEB-07-PRIVACY-LIFECYCLE",
        category="Privacy & Governance",
        title="Automated Data Lifecycle Redaction & Retention Policy Engine",
        description="Enforces retention expiration rules, candidate PII anonymization, and cryptographic shredding of session keys.",
        behavioral_contract="Anonymizes candidate PII, strips credentials/passwords, destroys expired session keys, logs compliance audit.",
        test_cases=[
            {"name": "Redact candidate email and IP context", "weight": 35},
            {"name": "Cryptographically shred expired session keys", "weight": 35},
            {"name": "Preserve non-PII evidence provenance", "weight": 30},
        ],
        reference_code="""
import re

class PrivacyLifecycleEngine:
    def __init__(self, retention_days=30):
        self.retention = retention_days

    def anonymize_event(self, event):
        cleaned = dict(event)
        payload = dict(cleaned.get("payload", {}))
        # Redact emails and IPs
        for k, v in list(payload.items()):
            if isinstance(v, str):
                v_redacted = re.sub(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', '[REDACTED_EMAIL]', v)
                v_redacted = re.sub(r'\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b', '[REDACTED_IP]', v_redacted)
                payload[k] = v_redacted
        cleaned["payload"] = payload
        return cleaned

    def shred_key(self, session_key_record):
        # Overwrite key material securely
        return {"session_id": session_key_record.get("session_id"), "status": "SHREDDED", "key_pem": None}
""",
        broken_code="""
class PrivacyLifecycleEngine:
    def anonymize_event(self, e): return e
    def shred_key(self, k): return k
""",
        mutated_code="""
# Mutated: redacts emails but leaves IP addresses exposed
import re
class PrivacyLifecycleEngine:
    def anonymize_event(self, event):
        cleaned = dict(event)
        p = dict(cleaned.get("payload", {}))
        for k, v in list(p.items()):
            if isinstance(v, str):
                p[k] = re.sub(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', '[REDACTED_EMAIL]', v)
        cleaned["payload"] = p
        return cleaned
    def shred_key(self, k): return {"status": "SHREDDED", "key_pem": None}
"""
    ),

    IOEBTask(
        task_id="IOEB-08-TIME-SERIES-AGG",
        category="Distributed Systems",
        title="High-Throughput Telemetry Window Aggregator",
        description="Streaming telemetry aggregator calculating p50, p95, p99 latency and count over fixed sliding windows.",
        behavioral_contract="Calculates accurate statistical percentiles across streaming data points, maintains rolling window bounds.",
        test_cases=[
            {"name": "Calculate p50 and p95 across window", "weight": 35},
            {"name": "Handle empty or single value stream", "weight": 35},
            {"name": "Rolling window eviction of aged samples", "weight": 30},
        ],
        reference_code="""
class TelemetryAggregator:
    def __init__(self, window_size=100):
        self.window_size = window_size
        self.samples = []

    def add(self, value):
        self.samples.append(value)
        if len(self.samples) > self.window_size:
            self.samples.pop(0)

    def get_percentile(self, p):
        if not self.samples: return 0.0
        sorted_data = sorted(self.samples)
        idx = int(len(sorted_data) * (p / 100.0))
        idx = min(idx, len(sorted_data) - 1)
        return float(sorted_data[idx])
""",
        broken_code="""
class TelemetryAggregator:
    def add(self, v): pass
    def get_percentile(self, p): return 0.0
""",
        mutated_code="""
# Mutated: returns average instead of true percentile
class TelemetryAggregator:
    def __init__(self, window_size=100): self.samples = []
    def add(self, v): self.samples.append(v)
    def get_percentile(self, p):
        return sum(self.samples) / len(self.samples) if self.samples else 0.0
"""
    )
]
