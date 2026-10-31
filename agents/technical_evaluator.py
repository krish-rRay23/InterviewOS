"""
Technical Evaluator Agent (Section 9.10).
Evaluates coding correctness, algorithmic complexity, and interview reasoning.
Enforces the core rule: Technical competency scoring is strictly decoupled from integrity status.
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Any
from execution.sandbox_runner import SandboxedExecutionService, ExecutionResult


@dataclass
class TechnicalScoreReport:
    session_id: str
    code_correctness_pct: float
    code_complexity_pct: float
    interview_competency_pct: float
    adaptive_challenge_pct: float
    total_score_pct: float
    passed: bool
    evaluation_summary: str


class TechnicalEvaluatorAgent:
    def __init__(self, sandbox_service: SandboxedExecutionService):
        self.sandbox = sandbox_service

    def evaluate_submission(self, session_id: str, language: str, source_code: str,
                            test_cases: List[Dict[str, str]], interview_concepts: List[str],
                            adaptive_challenge_passed: bool) -> TechnicalScoreReport:
        # 1. Run tests in sandbox
        if language == "python":
            exec_res = self.sandbox.execute_python(source_code, test_cases)
        elif language == "cpp":
            exec_res = self.sandbox.execute_cpp(source_code, test_cases)
        else:
            exec_res = self.sandbox.execute_python(source_code, test_cases)

        if exec_res.total_test_cases > 0:
            correctness_pct = (exec_res.test_cases_passed / exec_res.total_test_cases) * 100.0
        else:
            correctness_pct = 0.0

        # 2. Complexity Analysis
        # Check if linear/logarithmic or quadratic
        complexity_pct = 85.0
        if "for " in source_code and source_code.count("for ") >= 2:
            # Nested loop indicator
            complexity_pct = 70.0
        if "while " in source_code and "for " in source_code:
            complexity_pct = 75.0

        # 3. Interview Competency
        # Reward foundational engineering concepts discussed
        relevant_concepts_count = len(interview_concepts)
        interview_pct = min(100.0, 50.0 + relevant_concepts_count * 15.0)

        # 4. Adaptive Challenge
        adaptive_pct = 95.0 if adaptive_challenge_passed else 60.0

        # Total weighted score: Correctness (50%), Complexity (20%), Interview (20%), Adaptive (10%)
        total = (0.50 * correctness_pct) + (0.20 * complexity_pct) + (0.20 * interview_pct) + (0.10 * adaptive_pct)
        passed = (total >= 70.0) and (correctness_pct >= 60.0)

        summary = (f"Executed {exec_res.total_test_cases} test cases ({exec_res.test_cases_passed} passed). "
                   f"Max runtime: {exec_res.max_execution_time_ms}ms. Concepts demonstrated: {', '.join(interview_concepts) if interview_concepts else 'None'}.")

        return TechnicalScoreReport(
            session_id=session_id,
            code_correctness_pct=round(correctness_pct, 2),
            code_complexity_pct=round(complexity_pct, 2),
            interview_competency_pct=round(interview_pct, 2),
            adaptive_challenge_pct=round(adaptive_pct, 2),
            total_score_pct=round(total, 2),
            passed=passed,
            evaluation_summary=summary
        )

