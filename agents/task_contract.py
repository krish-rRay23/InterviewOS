"""
Typed Task Contracts for Structured Inter-Agent Communication (Section 10.1).
Replaces unconstrained free-form messages with versioned schema contracts.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Optional, Any
import uuid


class TaskStatus(Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    REJECTED_UNAUTHORIZED = "REJECTED_UNAUTHORIZED"
    TIMED_OUT = "TIMED_OUT"
    FAILED = "FAILED"


@dataclass
class AgentTaskContract:
    task_id: str
    session_id: str
    requesting_agent: str
    target_agent: str
    objective: str
    capability_token: str
    max_tool_calls: int = 5
    deadline_utc: str = ""
    evidence_references: List[str] = field(default_factory=list)
    status: TaskStatus = TaskStatus.PENDING
    result_payload: Optional[Dict[str, Any]] = None
    created_at_utc: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    @classmethod
    def create(cls, session_id: str, requesting_agent: str, target_agent: str,
               objective: str, capability_token: str, evidence_refs: List[str] = None, max_tools: int = 5):
        return cls(
            task_id=str(uuid.uuid4()),
            session_id=session_id,
            requesting_agent=requesting_agent,
            target_agent=target_agent,
            objective=objective,
            capability_token=capability_token,
            max_tool_calls=max_tools,
            deadline_utc=datetime.now(timezone.utc).isoformat(),
            evidence_references=evidence_refs or [],
            status=TaskStatus.PENDING,
            result_payload=None,
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "task_id": self.task_id,
            "session_id": self.session_id,
            "requesting_agent": self.requesting_agent,
            "target_agent": self.target_agent,
            "objective": self.objective,
            "capability_token": self.capability_token,
            "max_tool_calls": self.max_tool_calls,
            "deadline_utc": self.deadline_utc,
            "evidence_references": self.evidence_references,
            "status": self.status.value,
            "result_payload": self.result_payload,
            "created_at_utc": self.created_at_utc,
        }

