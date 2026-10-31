"""
Adaptive Challenge Agent (Section 9.9).
Generates calibrated, controlled validation tasks to verify genuine candidate understanding.
Enforces standardized difficulty budgets and decoupled integrity evaluation.
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Any
import uuid


@dataclass
class AdaptiveChallenge:
    challenge_id: str
    session_id: str
    challenge_type: str  # CODE_EXPLANATION, CONTROLLED_MODIFICATION, DEBUGGING, COMPLEXITY_ANALYSIS, EDGE_CASE_TEST
    prompt: str
    expected_criteria: List[str]
    time_limit_seconds: int
    difficulty: str  # EASY, MEDIUM, HARD


class AdaptiveChallengeAgent:
    def __init__(self):
        pass

    def generate_challenge(self, session_id: str, candidate_code: str,
                           detected_topics: List[str]) -> AdaptiveChallenge:
        """
        Synthesizes an adaptive challenge targeted to validate the candidate's actual comprehension.
        """
        # Look for loops/recursion in code
        has_recursion = "def " in candidate_code and "(" in candidate_code and candidate_code.count("(") > 3
        has_hashmap = "dict()" in candidate_code or "{" in candidate_code

        if has_hashmap:
            return AdaptiveChallenge(
                challenge_id=str(uuid.uuid4()),
                session_id=session_id,
                challenge_type="CONTROLLED_MODIFICATION",
                prompt="Your solution utilizes an auxiliary hash table yielding O(N) space complexity. Can you optimize or explain how to adapt this algorithm to achieve O(1) auxiliary space without modifying the input array?",
                expected_criteria=[
                    "Recognizes space-time tradeoff",
                    "Mentions in-place two-pointer technique or cycle-sort/bit manipulation",
                    "Correctly identifies asymptotic space reduction"
                ],
                time_limit_seconds=180,
                difficulty="MEDIUM"
            )
        elif has_recursion:
            return AdaptiveChallenge(
                challenge_id=str(uuid.uuid4()),
                session_id=session_id,
                challenge_type="DEBUGGING",
                prompt="Consider a scenario where the recursion depth reaches 10^5 elements. What runtime exception would occur, and how would you restructure the solution iteratively with an explicit stack to prevent call-stack overflow?",
                expected_criteria=[
                    "Identifies RecursionError / Maximum call stack exceeded",
                    "Provides iterative formulation with while loop and explicit deque/list",
                    "Correctly maintains state invariants across iterations"
                ],
                time_limit_seconds=240,
                difficulty="HARD"
            )
        else:
            return AdaptiveChallenge(
                challenge_id=str(uuid.uuid4()),
                session_id=session_id,
                challenge_type="COMPLEXITY_ANALYSIS",
                prompt="Please walk through the exact mathematical time complexity of your inner loops. How would performance scale if input size N doubles from 10^4 to 2*10^4?",
                expected_criteria=[
                    "Identifies polynomial vs logarithmic vs linear scaling",
                    "Calculates expected operations count accurately",
                    "Explains constant factors and CPU cache locality effects"
                ],
                time_limit_seconds=120,
                difficulty="EASY"
            )

