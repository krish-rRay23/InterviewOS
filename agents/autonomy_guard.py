"""
Autonomy Guard: Deterministic Capability Authorization System for Autonomous Agents.
Enforces Section 10: Mandatory least-privilege, session-bound capability tokens,
tool call budgeting, and non-negotiable security boundaries.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Optional, Set
import hashlib
import json


class Capability(Enum):
    READ_VERIFIED_EVENTS = "read_verified_events"
    REQUEST_DEVICE_SNAPSHOT = "request_device_snapshot"
    REQUEST_PROCESS_SNAPSHOT = "request_process_snapshot"
    REQUEST_DISPLAY_SNAPSHOT = "request_display_snapshot"
    CREATE_INVESTIGATION = "create_investigation"
    REQUEST_ADAPTIVE_CHALLENGE = "request_adaptive_challenge"
    EXECUTE_CONTROLLED_TEST = "execute_controlled_test"
    READ_CODE_SUBMISSION = "read_code_submission"
    VERIFY_EVIDENCE_BATCH = "verify_evidence_batch"
    PAUSE_ASSESSMENT = "pause_assessment"
    FINALIZE_ASSESSMENT = "finalize_assessment"


# Forbidden capabilities that can never be granted to ordinary LLM agents
FORBIDDEN_AGENT_CAPABILITIES: Set[str] = {
    "modify_assessment_policy",
    "export_unrelated_candidate_data",
    "access_other_org_sessions",
    "delete_raw_evidence",
    "modify_cryptographic_results",
    "execute_arbitrary_shell",
    "terminate_arbitrary_processes",
    "install_arbitrary_software",
    "grant_self_permissions",
}


@dataclass
class CapabilityToken:
    token_id: str
    agent_id: str
    session_id: str
    allowed_capabilities: Set[Capability]
    max_tool_calls: int
    tool_calls_used: int = 0
    expires_at_utc: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def is_expired(self) -> bool:
        return datetime.now(timezone.utc) > self.expires_at_utc

    def has_budget(self) -> bool:
        return self.tool_calls_used < self.max_tool_calls


class AutonomyGuard:
    def __init__(self):
        self.active_tokens: Dict[str, CapabilityToken] = {}
        self.authorization_audit_log: List[Dict] = []
        self.agent_role_permissions: Dict[str, Set[Capability]] = {
            "AssessmentCommander": {
                Capability.READ_VERIFIED_EVENTS,
                Capability.CREATE_INVESTIGATION,
                Capability.REQUEST_ADAPTIVE_CHALLENGE,
                Capability.EXECUTE_CONTROLLED_TEST,
                Capability.READ_CODE_SUBMISSION,
                Capability.PAUSE_ASSESSMENT,
                Capability.FINALIZE_ASSESSMENT,
            },
            "EndpointSentinel": {
                Capability.READ_VERIFIED_EVENTS,
                Capability.REQUEST_PROCESS_SNAPSHOT,
            },
            "DeviceIntelligence": {
                Capability.READ_VERIFIED_EVENTS,
                Capability.REQUEST_DEVICE_SNAPSHOT,
                Capability.REQUEST_DISPLAY_SNAPSHOT,
            },
            "NetworkIntelligence": {
                Capability.READ_VERIFIED_EVENTS,
            },
            "EvidenceCustodian": {
                Capability.READ_VERIFIED_EVENTS,
                Capability.VERIFY_EVIDENCE_BATCH,
            },
            "BehavioralInvestigator": {
                Capability.READ_VERIFIED_EVENTS,
                Capability.REQUEST_PROCESS_SNAPSHOT,
                Capability.REQUEST_DEVICE_SNAPSHOT,
                Capability.CREATE_INVESTIGATION,
            },
            "CodeForensics": {
                Capability.READ_CODE_SUBMISSION,
            },
            "MultilingualInterviewer": {
                Capability.READ_VERIFIED_EVENTS,
            },
            "AdaptiveChallenge": {
                Capability.READ_CODE_SUBMISSION,
                Capability.REQUEST_ADAPTIVE_CHALLENGE,
            },
            "TechnicalEvaluator": {
                Capability.READ_CODE_SUBMISSION,
                Capability.EXECUTE_CONTROLLED_TEST,
            },
            "RecoveryAgent": {
                Capability.READ_VERIFIED_EVENTS,
                Capability.VERIFY_EVIDENCE_BATCH,
            },
        }

    def mint_token(self, agent_id: str, session_id: str, max_tool_calls: int = 15, duration_seconds: int = 1800) -> str:
        token_id = hashlib.sha256(f"{agent_id}:{session_id}:{datetime.now().isoformat()}".encode()).hexdigest()[:32]
        allowed = self.agent_role_permissions.get(agent_id, set())
        token = CapabilityToken(
            token_id=token_id,
            agent_id=agent_id,
            session_id=session_id,
            allowed_capabilities=allowed,
            max_tool_calls=max_tool_calls,
            tool_calls_used=0,
            expires_at_utc=datetime.fromtimestamp(datetime.now(timezone.utc).timestamp() + duration_seconds, timezone.utc)
        )
        self.active_tokens[token_id] = token
        return token_id

    def authorize_tool_call(self, token_id: str, requested_capability: str, session_id: str, resource: str = "") -> bool:
        timestamp = datetime.now(timezone.utc).isoformat()

        # 1. Deny non-negotiable forbidden capabilities outright
        if requested_capability in FORBIDDEN_AGENT_CAPABILITIES:
            self._log_audit(token_id, requested_capability, session_id, False, "FORBIDDEN_OPERATION_BLOCKED")
            return False

        # 2. Token lookup
        token = self.active_tokens.get(token_id)
        if not token:
            self._log_audit(token_id, requested_capability, session_id, False, "TOKEN_NOT_FOUND")
            return False

        # 3. Session boundary check (tenant isolation)
        if token.session_id != session_id:
            self._log_audit(token_id, requested_capability, session_id, False, "SESSION_MISMATCH_ATTACK")
            return False

        # 4. Token expiration check
        if token.is_expired():
            self._log_audit(token_id, requested_capability, session_id, False, "TOKEN_EXPIRED")
            return False

        # 5. Tool call budget check
        if not token.has_budget():
            self._log_audit(token_id, requested_capability, session_id, False, "TOOL_BUDGET_EXCEEDED")
            return False

        # 6. Specific capability membership check
        try:
            cap_enum = Capability(requested_capability)
        except ValueError:
            self._log_audit(token_id, requested_capability, session_id, False, "UNKNOWN_CAPABILITY")
            return False

        if cap_enum not in token.allowed_capabilities:
            self._log_audit(token_id, requested_capability, session_id, False, "PERMISSION_NOT_GRANTED_TO_ROLE")
            return False

        # Deduct budget
        token.tool_calls_used += 1
        self._log_audit(token_id, requested_capability, session_id, True, f"AUTHORIZED (used: {token.tool_calls_used}/{token.max_tool_calls})")
        return True

    def _log_audit(self, token_id: str, capability: str, session_id: str, authorized: bool, reason: str):
        self.authorization_audit_log.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "token_id": token_id,
            "capability": capability,
            "session_id": session_id,
            "authorized": authorized,
            "reason": reason
        })
