"""
Multilingual Technical Interviewer Agent (Section 14).
Supports English, Hindi, and Hinglish technical conversations.
Guarantees verbatim transcript preservation, code-switch detection,
and language-independent technical concept extraction.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set
import re


@dataclass
class InterviewTurn:
    turn_id: str
    session_id: str
    speaker: str  # AGENT or CANDIDATE
    detected_language: str  # "en", "hi", "hinglish"
    original_transcript: str
    normalized_transcript: str
    technical_concepts: List[str]
    turn_timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class MultilingualInterviewer:
    def __init__(self):
        # Technical keywords mapped to canonical engineering concepts
        self.concept_lexicon = {
            # Concurrency & Distributed Systems
            "deadlock": "concurrency_control",
            "mutex": "concurrency_control",
            "lock": "concurrency_control",
            "thread": "threading",
            "process": "operating_systems",
            "consensus": "distributed_systems",
            "raft": "consensus_algorithms",
            "paxos": "consensus_algorithms",

            # Data Structures & Algorithms
            "hashmap": "hash_table",
            "hashtable": "hash_table",
            "hash": "hashing",
            "binary search": "binary_search",
            "tree": "trees",
            "graph": "graphs",
            "bfs": "graph_traversal",
            "dfs": "graph_traversal",
            "dp": "dynamic_programming",
            "memoization": "dynamic_programming",
            "time complexity": "algorithmic_complexity",
            "space complexity": "algorithmic_complexity",
            "o(n)": "algorithmic_complexity",
            "o(log n)": "algorithmic_complexity",

            # Hindi / Hinglish Technical colloquialisms
            "two pointer": "two_pointer_technique",
            "do pointer": "two_pointer_technique",
            "samay lagta hai": "algorithmic_complexity",
            "memory lagti hai": "space_complexity",
            "soch raha hoon": "reasoning_process",
            "chhota karte hain": "divide_and_conquer",
            "traverse karenge": "graph_traversal",
            "pointer aage badhayenge": "two_pointer_technique",
            "array mein store karenge": "array_storage",
            "queue use karenge": "queue_data_structure",
            "stack mein push karenge": "stack_data_structure",
        }

    def detect_language(self, text: str) -> str:
        """
        Detects whether the turn is English, pure Hindi (Devanagari), or Hinglish (code-switched).
        """
        # Check Devanagari script range
        devanagari_count = len(re.findall(r'[\u0900-\u097F]', text))
        if devanagari_count > len(text) * 0.3:
            return "hi"

        # Check Romanized Hindi keywords (Hinglish indicators)
        hinglish_markers = {
            "main", "karunga", "karenge", "karega", "hai", "hain", "hoga", "mein", "se", "aur",
            "kyunki", "pehle", "baad", "yeh", "woh", "kar", "raha", "rahe", "ke", "liye", "jisse",
            "rahegi", "hota", "karte", "hum", "aap", "karo", "karna"
        }
        words = set(re.findall(r'[a-zA-Z]+', text.lower()))
        overlap = words & hinglish_markers
        if len(overlap) >= 2 or (len(words) > 0 and len(overlap) / len(words) >= 0.10):
            return "hinglish"

        return "en"

    def process_candidate_turn(self, session_id: str, turn_id: str, raw_transcript: str) -> InterviewTurn:
        """
        Processes candidate verbal response:
        1. Preserves original verbatim transcript.
        2. Detects language and code-switching.
        3. Extracts technical concepts language-agnostically.
        """
        detected_lang = self.detect_language(raw_transcript)
        lower_text = raw_transcript.lower()

        extracted_concepts = set()
        for phrase, concept in self.concept_lexicon.items():
            if phrase in lower_text:
                extracted_concepts.add(concept)

        normalized = raw_transcript.strip()

        return InterviewTurn(
            turn_id=turn_id,
            session_id=session_id,
            speaker="CANDIDATE",
            detected_language=detected_lang,
            original_transcript=raw_transcript,
            normalized_transcript=normalized,
            technical_concepts=sorted(list(extracted_concepts))
        )

    def generate_followup_question(self, turn: InterviewTurn, current_problem: str) -> str:
        """
        Generates context-aware technical follow up in a natural matching tone.
        Uses Local AI Provider with fallback to deterministic pattern matching.
        """
        concepts = turn.technical_concepts
        lang = turn.detected_language

        try:
            from intelligence.llm_adapters import get_llm_provider
            provider = get_llm_provider()
            followup = provider.generate_interview_followup(turn.original_transcript, concepts, lang)
            if followup and not followup.startswith("Local inference unavailable"):
                return followup
        except Exception:
            pass

        if "two_pointer_technique" in concepts or "binary_search" in concepts:
            if lang in ("hinglish", "hi"):
                return "Sahi approach hai! Lekin agar array sorted na ho, tab time complexity par kya asar padega?"
            return "That approach is sound. However, if the array is not pre-sorted, how does that impact the overall time complexity?"

        if "algorithmic_complexity" in concepts or "hash_table" in concepts:
            if lang in ("hinglish", "hi"):
                return "Hash map se O(1) average lookup milega, par worst-case collision scenario mein complexity kaise handle karenge?"
            return "A hash map provides O(1) average lookup. How would you mitigate performance degradation in a worst-case collision scenario?"

        # Default fallback
        if lang in ("hinglish", "hi"):
            return "Aap is solution ke edge cases explain kar sakte hain, jaise empty inputs ya duplicates?"
        return "Can you walk me through the edge cases for this solution, such as empty inputs or extreme duplicate frequencies?"
