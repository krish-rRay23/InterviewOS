import unittest
import sys
import os

# Add root directory to python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
os.environ["INTERVIEWOS_ALLOW_UNSAFE_HOST_EXECUTION"] = "true"

from agents.autonomy_guard import AutonomyGuard, Capability
from agents.investigator import BehavioralInvestigatorAgent
from agents.commander import AssessmentCommanderAgent
from agents.temporal_workflow import AssessmentTemporalWorkflow, WorkflowState
from intelligence.code_forensics import CodeForensicsEngine
from intelligence.interviewer import MultilingualInterviewer
from intelligence.llm_adapters import get_llm_provider, DeterministicLocalProvider
from intelligence.speech_adapters import get_speech_adapter, LocalSpeechAdapter
from execution.sandbox_runner import SandboxedExecutionService


class TestAutonomyGuard(unittest.TestCase):
    def setUp(self):
        self.guard = AutonomyGuard()

    def test_mint_and_authorize_valid_capability(self):
        token_id = self.guard.mint_token("EndpointSentinel", "session-1", max_tool_calls=5)
        authorized = self.guard.authorize_tool_call(token_id, "read_verified_events", "session-1")
        self.assertTrue(authorized)

    def test_reject_forbidden_capabilities(self):
        token_id = self.guard.mint_token("AssessmentCommander", "session-1", max_tool_calls=5)
        # Attempt dangerous shell execution
        self.assertFalse(self.guard.authorize_tool_call(token_id, "execute_arbitrary_shell", "session-1"))
        # Attempt deleting raw evidence
        self.assertFalse(self.guard.authorize_tool_call(token_id, "delete_raw_evidence", "session-1"))
        # Attempt modifying assessment policy
        self.assertFalse(self.guard.authorize_tool_call(token_id, "modify_assessment_policy", "session-1"))

    def test_reject_cross_session_tampering(self):
        token_id = self.guard.mint_token("EndpointSentinel", "session-1", max_tool_calls=5)
        # Attempt accessing session-2 using token for session-1
        authorized = self.guard.authorize_tool_call(token_id, "read_verified_events", "session-2")
        self.assertFalse(authorized)

    def test_tool_call_budget_exhaustion(self):
        token_id = self.guard.mint_token("EndpointSentinel", "session-1", max_tool_calls=2)
        self.assertTrue(self.guard.authorize_tool_call(token_id, "read_verified_events", "session-1"))
        self.assertTrue(self.guard.authorize_tool_call(token_id, "read_verified_events", "session-1"))
        # 3rd call must be rejected due to budget limit
        self.assertFalse(self.guard.authorize_tool_call(token_id, "read_verified_events", "session-1"))


class TestCodeForensics(unittest.TestCase):
    def setUp(self):
        self.engine = CodeForensicsEngine()

    def test_ast_normalization_and_similarity(self):
        # Two submissions with identical structure but renamed variables and spacing
        code_a = """
def two_sum(nums, target):
    lookup = {}
    for i, num in enumerate(nums):
        diff = target - num
        if diff in lookup:
            return [lookup[diff], i]
        lookup[num] = i
    return []
"""
        code_b = """
def findPair(arr, k):
    seen_map = dict()
    for index, val in enumerate(arr):
        remainder = k - val
        if remainder in seen_map:
            return [seen_map[remainder], index]
        seen_map[val] = index
    return []
"""
        rep = self.engine.compare_submissions("sub_1", code_a, "sub_2", code_b)
        self.assertGreater(rep.overall_similarity, 0.85)
        self.assertGreater(rep.ast_structural_similarity, 0.85)
        self.assertTrue(rep.is_suspicious_collusion)

    def test_distinct_algorithms_low_similarity(self):
        code_a = """
def solve(n):
    return n * (n + 1) // 2
"""
        code_b = """
def solve(n):
    total = 0
    for i in range(1, n + 1):
        total += i
    return total
"""
        rep = self.engine.compare_submissions("sub_1", code_a, "sub_2", code_b)
        self.assertLess(rep.overall_similarity, 0.70)


class TestMultilingualInterviewer(unittest.TestCase):
    def setUp(self):
        self.interviewer = MultilingualInterviewer()

    def test_hinglish_detection_and_concept_extraction(self):
        hinglish_turn = "Main do pointer technique use karunga array traverse karne ke liye, jisse time complexity O(n) rahegi."
        turn = self.interviewer.process_candidate_turn("sess-1", "turn-1", hinglish_turn)
        self.assertEqual(turn.detected_language, "hinglish")
        self.assertEqual(turn.original_transcript, hinglish_turn)
        self.assertIn("two_pointer_technique", turn.technical_concepts)
        self.assertIn("algorithmic_complexity", turn.technical_concepts)

    def test_english_detection_and_concept_extraction(self):
        english_turn = "I will use a hashmap for O(1) lookups and handle potential deadlocks using mutex locks."
        turn = self.interviewer.process_candidate_turn("sess-1", "turn-2", english_turn)
        self.assertEqual(turn.detected_language, "en")
        self.assertIn("hash_table", turn.technical_concepts)
        self.assertIn("concurrency_control", turn.technical_concepts)


class TestSandboxedExecutionService(unittest.TestCase):
    def setUp(self):
        self.sandbox = SandboxedExecutionService(default_timeout_seconds=2.0)

    def test_python_execution_success(self):
        code = """
import sys
data = sys.stdin.read().strip().split()
if data:
    nums = [int(x) for x in data]
    print(sum(nums))
"""
        test_cases = [
            {"input": "1 2 3", "expected": "6"},
            {"input": "10 20 -5", "expected": "25"},
        ]
        res = self.sandbox.execute_python(code, test_cases)
        self.assertTrue(res.all_passed)
        self.assertEqual(res.test_cases_passed, 2)

    def test_python_execution_timeout(self):
        code = """
while True:
    pass
"""
        test_cases = [{"input": "test", "expected": "out"}]
        res = self.sandbox.execute_python(code, test_cases)
        self.assertFalse(res.all_passed)
        self.assertIn("timed out", res.results[0].error_message)


class TestAssessmentCommanderLifecycle(unittest.TestCase):
    def setUp(self):
        self.commander = AssessmentCommanderAgent()

    def test_full_autonomous_lifecycle_clean(self):
        events = [
            {
                "event_id": "evt-1",
                "event_type": "PROCESS_STARTED",
                "payload": {"process_name": "code.exe", "classification": "APPROVED"}
            },
            {
                "event_id": "evt-2",
                "event_type": "DEVICE_CONNECTED",
                "payload": {"device_id": "USB_AUDIO_1", "category": "AUDIO"}
            }
        ]
        code = """
import sys
lines = sys.stdin.read().split()
if lines:
    print(len(lines))
"""
        test_cases = [{"input": "apple banana cherry", "expected": "3"}]
        transcripts = ["I will use an array to store elements and traverse with O(n) complexity."]

        outcome = self.commander.run_assessment_lifecycle(
            session_id="session-test-clean",
            assessment_id="asmt-1",
            candidate_id="cand-1",
            events=events,
            candidate_code=code,
            test_cases=test_cases,
            interview_transcripts=transcripts
        )

        self.assertEqual(outcome.session_state, "COMPLETED")
        self.assertEqual(outcome.integrity_state, "VERIFIED")
        self.assertEqual(outcome.technical_result, "PASSED")
        self.assertGreaterEqual(outcome.technical_score_pct, 70.0)

    def test_full_autonomous_lifecycle_with_restricted_process(self):
        events = [
            {
                "event_id": "evt-breach-1",
                "event_type": "PROCESS_STARTED",
                "payload": {"process_name": "anydesk.exe", "classification": "RESTRICTED"}
            }
        ]
        code = "print('hello')"
        test_cases = [{"input": "", "expected": "hello"}]
        transcripts = ["Checking basic implementation."]

        outcome = self.commander.run_assessment_lifecycle(
            session_id="session-test-breach",
            assessment_id="asmt-1",
            candidate_id="cand-1",
            events=events,
            candidate_code=code,
            test_cases=test_cases,
            interview_transcripts=transcripts
        )

        self.assertEqual(outcome.integrity_state, "POLICY_BREACH_CONFIRMED")
        self.assertIn("evt-breach-1", outcome.integrity_evidence_references)


class TestTemporalWorkflowAndAdapters(unittest.TestCase):
    def test_temporal_workflow_lifecycle_and_replay_recovery(self):
        workflow = AssessmentTemporalWorkflow("sess-wf-001", "asmt-1", "cand-1")
        events = [
            {"event_id": "e-1", "event_type": "PROCESS_STARTED", "payload": {"process_name": "code.exe", "classification": "APPROVED"}},
            {"event_id": "e-2", "event_type": "DISPLAY_TOPOLOGY_CHANGED", "payload": {"display_count": 1}}
        ]
        code = "import sys\nprint('clean')"
        test_cases = [{"input": "", "expected": "clean"}]
        transcripts = ["Solving problem cleanly."]

        # 1. Run full workflow
        outcome = workflow.run(events, code, test_cases, transcripts)
        self.assertEqual(workflow.state, WorkflowState.COMPLETED)
        self.assertEqual(outcome.integrity_state, "VERIFIED")
        self.assertIn("ActivityFinalizeAssessment", workflow.history.completed_activities)

        # 2. Simulate worker restart & replay recovery
        replayed_outcome = workflow.simulate_worker_restart_and_recover(events, code, test_cases, transcripts)
        self.assertEqual(replayed_outcome.outcome_id, outcome.outcome_id)
        self.assertGreater(workflow.history.replayed_steps_count, 0)

    def test_llm_and_speech_adapters(self):
        llm = get_llm_provider()
        hypothesis = llm.generate_hypothesis(
            {"event_type": "PROCESS_STARTED", "payload": {"process_name": "anydesk.exe"}}, []
        )
        self.assertIn("anydesk.exe", hypothesis)

        speech = get_speech_adapter()
        res = speech.transcribe_audio(b"mock_audio")
        self.assertEqual(res["detected_language"], "hinglish")
        audio_out = speech.synthesize_speech("Hello candidate")
        self.assertTrue(len(audio_out) > 0)


if __name__ == "__main__":
    unittest.main()

