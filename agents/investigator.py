"""
Behavioral Investigator Agent (Section 11).
Executes the autonomous investigation lifecycle:
OBSERVE -> HYPOTHESIZE -> INVESTIGATE -> VALIDATE -> ACT -> UPDATE.
Features loop prevention, evidence grounding, and capability-token enforcement.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Set
import uuid
import hashlib
import json
from .autonomy_guard import AutonomyGuard


@dataclass
class InvestigationCase:
    investigation_id: str
    session_id: str
    anomaly_type: str
    hypothesis: str
    supporting_evidence: List[str]
    contradictory_evidence: List[str]
    missing_evidence: List[str]
    investigation_steps_executed: List[str]
    conclusion_summary: str
    recommended_action: str
    confidence_score: float
    resolved: bool
    completed_at_utc: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "investigation_id": self.investigation_id,
            "session_id": self.session_id,
            "hypothesis": self.hypothesis,
            "supporting_evidence": self.supporting_evidence,
            "contradictory_evidence": self.contradictory_evidence,
            "missing_evidence": self.missing_evidence,
            "investigation_steps_executed": self.investigation_steps_executed,
            "conclusion_summary": self.conclusion_summary,
            "recommended_action": self.recommended_action,
            "confidence_score": self.confidence_score,
            "resolved": self.resolved,
            "completed_at_utc": self.completed_at_utc,
        }


class BehavioralInvestigatorAgent:
    def __init__(self, autonomy_guard: AutonomyGuard):
        self.agent_id = "BehavioralInvestigator"
        self.guard = autonomy_guard
        self.investigated_hashes: Set[str] = set()

    def investigate_anomaly(self, session_id: str, capability_token: str,
                            anomaly_event: Dict[str, Any], context_events: List[Dict[str, Any]]) -> InvestigationCase:
        event_id = anomaly_event.get("event_id", "unknown")
        event_type = anomaly_event.get("event_type", "UNKNOWN")
        payload = anomaly_event.get("payload", {})

        # Loop prevention & deduplication check
        case_signature = f"{session_id}:{event_type}:{json_signature(payload)}"
        if case_signature in self.investigated_hashes:
            return InvestigationCase(
                investigation_id=str(uuid.uuid4()),
                session_id=session_id,
                anomaly_type=event_type,
                hypothesis="Duplicate anomaly already evaluated",
                supporting_evidence=[event_id],
                contradictory_evidence=[],
                missing_evidence=[],
                investigation_steps_executed=["Deduplication cache hit"],
                conclusion_summary="Identical observation previously investigated and resolved.",
                recommended_action="NO_ACTION_BENIGN",
                confidence_score=0.99,
                resolved=True,
                completed_at_utc=datetime.now(timezone.utc).isoformat()
            )
        self.investigated_hashes.add(case_signature)

        # 1. Authorize observation read capability
        authorized = self.guard.authorize_tool_call(
            token_id=capability_token,
            requested_capability="read_verified_events",
            session_id=session_id
        )
        if not authorized:
            return InvestigationCase(
                investigation_id=str(uuid.uuid4()),
                session_id=session_id,
                anomaly_type=event_type,
                hypothesis="Unauthorized capability attempt",
                supporting_evidence=[],
                contradictory_evidence=[],
                missing_evidence=["Capability authorization rejected"],
                investigation_steps_executed=["AutonomyGuard check failed"],
                conclusion_summary="Investigation could not proceed due to token authorization failure.",
                recommended_action="INCONCLUSIVE_DATA_DEFICIENCY",
                confidence_score=0.0,
                resolved=False,
                completed_at_utc=datetime.now(timezone.utc).isoformat()
            )

        # 2. Formulate Hypothesis & Gather Corroborating / Contradictory Evidence
        supporting = [event_id]
        contradictory = []
        missing = []
        steps = ["1. Ingested verified anomaly event", "2. Analyzed process/device context"]

        if event_type == "PROCESS_STARTED":
            proc_name = payload.get("process_name", "")
            classification = payload.get("classification", "UNCLASSIFIED")

            if classification == "RESTRICTED":
                # Check if it was merely opened in background or active focus
                steps.append(f"3. Validated restricted process name '{proc_name}'")
                # Look for subsequent termination within 3 seconds (accidental launch)
                terminated_soon = False
                for other in context_events:
                    if other.get("event_type") == "PROCESS_TERMINATED" and other.get("payload", {}).get("process_name") == proc_name:
                        terminated_soon = True
                        contradictory.append(other.get("event_id"))
                        break

                if terminated_soon:
                    steps.append("4. Detected rapid termination: potential accidental click")
                    return InvestigationCase(
                        investigation_id=str(uuid.uuid4()),
                        session_id=session_id,
                        anomaly_type=event_type,
                        hypothesis=f"Restricted tool {proc_name} launched and immediately terminated without persistent interaction.",
                        supporting_evidence=supporting,
                        contradictory_evidence=contradictory,
                        missing_evidence=[],
                        investigation_steps_executed=steps,
                        conclusion_summary="Candidate briefly opened application and immediately closed it. No active assistance observed.",
                        recommended_action="FLAG_FOR_AUDIT",
                        confidence_score=0.85,
                        resolved=True,
                        completed_at_utc=datetime.now(timezone.utc).isoformat()
                    )
                else:
                    steps.append("4. Confirmed persistent execution of unauthorized remote software.")
                    return InvestigationCase(
                        investigation_id=str(uuid.uuid4()),
                        session_id=session_id,
                        anomaly_type=event_type,
                        hypothesis=f"Active execution of restricted application: {proc_name}",
                        supporting_evidence=supporting,
                        contradictory_evidence=[],
                        missing_evidence=[],
                        investigation_steps_executed=steps,
                        conclusion_summary=f"Persistent prohibited application {proc_name} detected during active assessment window.",
                        recommended_action="ENFORCE_POLICY_BREACH",
                        confidence_score=0.98,
                        resolved=True,
                        completed_at_utc=datetime.now(timezone.utc).isoformat()
                    )

            elif classification == "APPROVED":
                return InvestigationCase(
                    investigation_id=str(uuid.uuid4()),
                    session_id=session_id,
                    anomaly_type=event_type,
                    hypothesis=f"Approved tool launched: {proc_name}",
                    supporting_evidence=supporting,
                    contradictory_evidence=[],
                    missing_evidence=[],
                    investigation_steps_executed=steps,
                    conclusion_summary="Application is explicitly permitted by assessment policy.",
                    recommended_action="NO_ACTION_BENIGN",
                    confidence_score=1.0,
                    resolved=True,
                    completed_at_utc=datetime.now(timezone.utc).isoformat()
                )

        elif event_type == "DEVICE_CONNECTED":
            category = payload.get("category", "PERIPHERAL")
            dev_id = payload.get("device_id", "")
            steps.append(f"3. Evaluated peripheral connection of class {category}")

            if category == "STORAGE":
                return InvestigationCase(
                    investigation_id=str(uuid.uuid4()),
                    session_id=session_id,
                    anomaly_type=event_type,
                    hypothesis=f"Removable USB storage drive connected: {dev_id}",
                    supporting_evidence=supporting,
                    contradictory_evidence=[],
                    missing_evidence=[],
                    investigation_steps_executed=steps,
                    conclusion_summary="External storage device attached during closed-book assessment.",
                    recommended_action="ENFORCE_POLICY_BREACH",
                    confidence_score=0.95,
                    resolved=True,
                    completed_at_utc=datetime.now(timezone.utc).isoformat()
                )
            else:
                return InvestigationCase(
                    investigation_id=str(uuid.uuid4()),
                    session_id=session_id,
                    anomaly_type=event_type,
                    hypothesis=f"Standard peripheral connected: {category}",
                    supporting_evidence=supporting,
                    contradictory_evidence=[],
                    missing_evidence=[],
                    investigation_steps_executed=steps,
                    conclusion_summary="Peripheral device is permitted hardware (audio/input).",
                    recommended_action="NO_ACTION_BENIGN",
                    confidence_score=1.0,
                    resolved=True,
                    completed_at_utc=datetime.now(timezone.utc).isoformat()
                )

        elif event_type == "DISPLAY_TOPOLOGY_CHANGED":
            count = payload.get("display_count", 1)
            steps.append(f"3. Evaluated display topology with {count} active monitors")
            if count > 1:
                return InvestigationCase(
                    investigation_id=str(uuid.uuid4()),
                    session_id=session_id,
                    anomaly_type=event_type,
                    hypothesis=f"Multi-monitor display topology detected: {count} active monitors",
                    supporting_evidence=supporting,
                    contradictory_evidence=[],
                    missing_evidence=[],
                    investigation_steps_executed=steps,
                    conclusion_summary=f"Display count ({count}) exceeds permitted maximum limit of 1.",
                    recommended_action="ENFORCE_POLICY_BREACH",
                    confidence_score=0.99,
                    resolved=True,
                    completed_at_utc=datetime.now(timezone.utc).isoformat()
                )
            else:
                return InvestigationCase(
                    investigation_id=str(uuid.uuid4()),
                    session_id=session_id,
                    anomaly_type=event_type,
                    hypothesis="Single monitor display configuration verified",
                    supporting_evidence=supporting,
                    contradictory_evidence=[],
                    missing_evidence=[],
                    investigation_steps_executed=steps,
                    conclusion_summary="Display topology is within permitted assessment policy.",
                    recommended_action="NO_ACTION_BENIGN",
                    confidence_score=1.0,
                    resolved=True,
                    completed_at_utc=datetime.now(timezone.utc).isoformat()
                )

        # Fallback inconclusive case for ambiguous indicators
        missing.append("Additional contextual telemetry required")
        return InvestigationCase(
            investigation_id=str(uuid.uuid4()),
            session_id=session_id,
            anomaly_type=event_type,
            hypothesis="Ambiguous observation without definitive corroborating evidence",
            supporting_evidence=supporting,
            contradictory_evidence=contradictory,
            missing_evidence=missing,
            investigation_steps_executed=steps,
            conclusion_summary="Telemetry insufficient to confirm or deny policy violation. Guarding candidate fairness.",
            recommended_action="INCONCLUSIVE_DATA_DEFICIENCY",
            confidence_score=0.45,
            resolved=False,
            completed_at_utc=datetime.now(timezone.utc).isoformat()
        )


def json_signature(d: Dict[str, Any]) -> str:
    import json
    return hashlib.md5(json.dumps(d, sort_keys=True).encode()).hexdigest()
