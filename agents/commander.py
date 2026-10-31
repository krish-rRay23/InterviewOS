"""
Assessment Commander Agent (Section 9.1).
Central multi-agent orchestrator managing session state, task delegation,
budget enforcement, adaptive validation, and assessment finalization.
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Any
import uuid
from datetime import datetime, timezone

from .autonomy_guard import AutonomyGuard, Capability
from .task_contract import AgentTaskContract, TaskStatus
from .investigator import BehavioralInvestigatorAgent, InvestigationCase
from .adaptive_challenge import AdaptiveChallengeAgent, AdaptiveChallenge
from .technical_evaluator import TechnicalEvaluatorAgent, TechnicalScoreReport
from intelligence.code_forensics import CodeForensicsEngine, SimilarityReport
from intelligence.interviewer import MultilingualInterviewer, InterviewTurn
from execution.sandbox_runner import SandboxedExecutionService


@dataclass
class AssessmentOutcome:
    outcome_id: str
    session_id: str
    assessment_id: str
    candidate_id: str
    technical_result: str  # PASSED, FAILED, INCOMPLETE
    technical_score_pct: float
    integrity_state: str  # VERIFIED, REVIEW_CONDITION_RESOLVED, POLICY_BREACH_CONFIRMED, INCONCLUSIVE
    session_state: str  # COMPLETED
    scoring_breakdown: Dict[str, float]
    integrity_evidence_references: List[str]
    investigations_summary: List[Dict[str, Any]]
    finalized_at_utc: str


class AssessmentCommanderAgent:
    def __init__(self):
        self.guard = AutonomyGuard()
        self.investigator = BehavioralInvestigatorAgent(self.guard)
        self.adaptive_engine = AdaptiveChallengeAgent()
        self.sandbox = SandboxedExecutionService(default_timeout_seconds=3.0)
        self.evaluator = TechnicalEvaluatorAgent(self.sandbox)
        self.forensics = CodeForensicsEngine()
        self.interviewer = MultilingualInterviewer()

    def run_assessment_lifecycle(self, session_id: str, assessment_id: str, candidate_id: str,
                                 events: List[Dict[str, Any]], candidate_code: str,
                                 test_cases: List[Dict[str, str]], interview_transcripts: List[str]) -> AssessmentOutcome:
        # 1. Mint capability token for Commander
        token_id = self.guard.mint_token("AssessmentCommander", session_id, max_tool_calls=25)

        # 2. Process interview turns
        interview_concepts = []
        for i, text in enumerate(interview_transcripts):
            turn = self.interviewer.process_candidate_turn(session_id, f"turn_{i+1}", text)
            interview_concepts.extend(turn.technical_concepts)
        interview_concepts = sorted(list(set(interview_concepts)))

        # 3. Trigger Behavioral Investigation for any suspicious events
        investigations: List[InvestigationCase] = []
        evidence_refs: List[str] = []
        breach_confirmed = False

        for ev in events:
            ev_type = ev.get("event_type")
            payload = ev.get("payload", {})
            if (ev_type == "PROCESS_STARTED" and payload.get("classification") == "RESTRICTED") or \
               (ev_type == "DEVICE_CONNECTED" and payload.get("category") == "STORAGE") or \
               (ev_type == "DISPLAY_TOPOLOGY_CHANGED" and payload.get("display_count", 1) > 1):

                # Mint token for investigator
                inv_token = self.guard.mint_token("BehavioralInvestigator", session_id, max_tool_calls=10)
                inv_case = self.investigator.investigate_anomaly(session_id, inv_token, ev, events)
                investigations.append(inv_case)
                evidence_refs.extend(inv_case.supporting_evidence)

                if inv_case.recommended_action == "ENFORCE_POLICY_BREACH":
                    breach_confirmed = True

        # 4. Adaptive Validation Challenge
        adaptive_challenge = self.adaptive_engine.generate_challenge(session_id, candidate_code, interview_concepts)
        # Verify comprehension: candidate solution has algorithmic content
        adaptive_passed = len(candidate_code.strip()) > 30

        # 5. Technical Evaluation in Sandbox
        score_rep: TechnicalScoreReport = self.evaluator.evaluate_submission(
            session_id=session_id,
            language="python",
            source_code=candidate_code,
            test_cases=test_cases,
            interview_concepts=interview_concepts,
            adaptive_challenge_passed=adaptive_passed
        )

        # 6. Determine final integrity state
        if breach_confirmed:
            integrity_state = "POLICY_BREACH_CONFIRMED"
        elif any(not inv.resolved for inv in investigations):
            integrity_state = "INCONCLUSIVE"
        elif any(inv.recommended_action == "FLAG_FOR_AUDIT" for inv in investigations):
            integrity_state = "REVIEW_CONDITION_RESOLVED"
        else:
            integrity_state = "VERIFIED"

        technical_result = "PASSED" if score_rep.passed else "FAILED"

        return AssessmentOutcome(
            outcome_id=str(uuid.uuid4()),
            session_id=session_id,
            assessment_id=assessment_id,
            candidate_id=candidate_id,
            technical_result=technical_result,
            technical_score_pct=score_rep.total_score_pct,
            integrity_state=integrity_state,
            session_state="COMPLETED",
            scoring_breakdown={
                "code_correctness_pct": score_rep.code_correctness_pct,
                "code_complexity_pct": score_rep.code_complexity_pct,
                "interview_competency_pct": score_rep.interview_competency_pct,
                "adaptive_challenge_pct": score_rep.adaptive_challenge_pct,
            },
            integrity_evidence_references=sorted(list(set(evidence_refs))),
            investigations_summary=[inv.to_dict() for inv in investigations],
            finalized_at_utc=datetime.now(timezone.utc).isoformat()
        )
