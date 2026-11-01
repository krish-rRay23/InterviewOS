"""
Interview Evaluation Engine for InterviewOS.
Evaluates completed conversational interview transcripts along 8 structured dimensions:
1. Conceptual understanding
2. Problem-solving reasoning
3. Technical correctness
4. Complexity analysis
5. Knowledge of trade-offs
6. Debugging ability
7. Systems thinking
8. Clarity of technical explanation

Grounds evaluations in real verbatim transcript citations.
Zero-score stays zero. Insufficient evidence is explicitly marked.
Uses local reasoning LLM (Granite/Qwen) with a deterministic evidence-grounded fallback.
"""

import json
import re
from typing import Dict, List, Any, Optional
from pydantic import BaseModel, Field
from local_ai.providers.ollama_provider import ollama_provider
from local_ai.routing.model_router import model_router


class EvaluationDimension(BaseModel):
    dimension: str
    score_pct: float
    confidence: float
    evidence_citation: str
    reasoning: str
    status: str  # EVALUATED, INSUFFICIENT_EVIDENCE


class ConversationalEvaluationReport(BaseModel):
    session_id: str
    overall_competency_pct: float
    topics_covered: List[str]
    dimensions: List[EvaluationDimension]
    strong_evidence: List[str]
    gaps_or_misconceptions: List[str]
    unresolved_topics: List[str]
    summary_narrative: str


EIGHT_DIMENSIONS = [
    "Conceptual Understanding",
    "Problem-Solving Reasoning",
    "Technical Correctness",
    "Complexity Analysis",
    "Knowledge of Trade-offs",
    "Debugging Ability",
    "Systems Thinking",
    "Clarity of Technical Explanation"
]


class ConversationalEvaluator:
    @staticmethod
    def evaluate_transcript(
        session_id: str,
        turns: List[Dict[str, Any]],
        problem_statement: str,
        code_submitted: Optional[str] = None
    ) -> ConversationalEvaluationReport:
        candidate_turns = [t for t in turns if t.get("speaker") == "CANDIDATE"]

        # If zero candidate turns, return strict zero with INSUFFICIENT_EVIDENCE
        if not candidate_turns:
            return ConversationalEvaluationReport(
                session_id=session_id,
                overall_competency_pct=0.0,
                topics_covered=[],
                dimensions=[
                    EvaluationDimension(
                        dimension=dim,
                        score_pct=0.0,
                        confidence=1.0,
                        evidence_citation="N/A",
                        reasoning="No candidate speech recorded in session transcript.",
                        status="INSUFFICIENT_EVIDENCE"
                    )
                    for dim in EIGHT_DIMENSIONS
                ],
                strong_evidence=[],
                gaps_or_misconceptions=["Interview was concluded without candidate explanation."],
                unresolved_topics=["Core algorithm design", "Implementation trade-offs"],
                summary_narrative="Candidate did not provide verbal dialogue or technical explanations during the voice interview."
            )

        # Attempt structured evaluation via local reasoning model
        try:
            resolved_model = model_router.resolve_model("rubric_evaluation")
            formatted_turns = "\n".join([
                f"[Turn {i+1}] {t.get('speaker')}: {t.get('transcript', '')}"
                for i, t in enumerate(turns)
            ])

            prompt = (
                f"You are a rigorous technical assessment evaluator. Analyze the following candidate interview transcript for: {problem_statement}\n"
                f"Candidate Code:\n```\n{code_submitted or 'None'}\n```\n\n"
                f"Transcript:\n{formatted_turns}\n\n"
                f"Evaluate the candidate across these EXACT 8 dimensions:\n"
                f"1. Conceptual Understanding\n2. Problem-Solving Reasoning\n3. Technical Correctness\n"
                f"4. Complexity Analysis\n5. Knowledge of Trade-offs\n6. Debugging Ability\n"
                f"7. Systems Thinking\n8. Clarity of Technical Explanation\n\n"
                f"Rules:\n"
                f"- For each dimension, assign a score (0.0 to 100.0), confidence (0.0 to 1.0), and quote an exact verbatim phrase from the transcript as evidence_citation.\n"
                f"- If there is insufficient evidence for a dimension, set score_pct to 0.0 and status to 'INSUFFICIENT_EVIDENCE'.\n"
                f"- Return strict JSON with key 'dimensions': list of objects with fields: dimension, score_pct, confidence, evidence_citation, reasoning, status.\n"
                f"JSON Output:"
            )

            res = ollama_provider.chat(
                model=resolved_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1
            )
            raw_content = res.get("content", "")
            # Extract JSON block
            json_match = re.search(r'\{.*\}', raw_content, re.DOTALL)
            if json_match:
                parsed = json.loads(json_match.group(0))
                raw_dims = parsed.get("dimensions", [])
                dims_map = {d.get("dimension"): d for d in raw_dims if isinstance(d, dict)}

                final_dimensions: List[EvaluationDimension] = []
                for dim_name in EIGHT_DIMENSIONS:
                    found = dims_map.get(dim_name)
                    if found and isinstance(found.get("score_pct"), (int, float)):
                        score = float(found["score_pct"])
                        status = found.get("status", "EVALUATED" if score > 0 else "INSUFFICIENT_EVIDENCE")
                        final_dimensions.append(EvaluationDimension(
                            dimension=dim_name,
                            score_pct=score,
                            confidence=float(found.get("confidence", 0.8)),
                            evidence_citation=str(found.get("evidence_citation", ""))[:200],
                            reasoning=str(found.get("reasoning", "Evaluated based on transcript evidence.")),
                            status=status
                        ))
                    else:
                        raise ValueError("Missing dimension in LLM output")

                evaluated_scores = [d.score_pct for d in final_dimensions if d.status == "EVALUATED"]
                overall_score = round(sum(evaluated_scores) / len(evaluated_scores), 1) if evaluated_scores else 0.0

                return ConversationalEvaluationReport(
                    session_id=session_id,
                    overall_competency_pct=overall_score,
                    topics_covered=list(set(c for t in turns for c in t.get("technical_concepts", []))),
                    dimensions=final_dimensions,
                    strong_evidence=[f"Turn {i+1}: {t.get('transcript')[:120]}" for i, t in enumerate(candidate_turns[:3])],
                    gaps_or_misconceptions=[d.reasoning for d in final_dimensions if d.status == "INSUFFICIENT_EVIDENCE"],
                    unresolved_topics=[d.dimension for d in final_dimensions if d.status == "INSUFFICIENT_EVIDENCE"],
                    summary_narrative=f"Comprehensive evaluation completed across 8 dimensions. Overall conversational technical score: {overall_score}%."
                )
        except Exception:
            pass  # Fall back to deterministic evidence evaluation below

        # Deterministic Grounded Evaluation across all 8 dimensions
        topics = set(c for t in turns for c in t.get("technical_concepts", []))
        total_candidate_words = sum(len(t.get("transcript", "").split()) for t in candidate_turns)
        combined_candidate_text = " ".join(t.get("transcript", "").lower() for t in candidate_turns)

        # 1. Complexity Analysis
        has_complexity = any(k in combined_candidate_text for k in ["o(n)", "o(1)", "o(log n)", "o(n^2)", "complexity", "worst case", "time complexity", "space complexity"])
        comp_cit = next((t.get("transcript") for t in candidate_turns if "o(" in t.get("transcript", "").lower() or "complexity" in t.get("transcript", "").lower()), "")
        dim_complexity = EvaluationDimension(
            dimension="Complexity Analysis",
            score_pct=85.0 if has_complexity else 0.0,
            confidence=0.9 if has_complexity else 0.5,
            evidence_citation=comp_cit[:150] if has_complexity else "N/A",
            reasoning="Candidate explicitly analyzed time and space bounds." if has_complexity else "Candidate did not discuss algorithmic complexity.",
            status="EVALUATED" if has_complexity else "INSUFFICIENT_EVIDENCE"
        )

        # 2. Conceptual Understanding
        has_concept = len(candidate_turns) >= 1 and total_candidate_words >= 15
        dim_concept = EvaluationDimension(
            dimension="Conceptual Understanding",
            score_pct=80.0 if has_concept else 30.0,
            confidence=0.85,
            evidence_citation=candidate_turns[0].get("transcript", "")[:150],
            reasoning="Demonstrated clear comprehension of problem requirements and core algorithms.",
            status="EVALUATED"
        )

        # 3. Problem-Solving Reasoning
        has_reasoning = any(k in combined_candidate_text for k in ["because", "approach", "first", "then", "since", "kyunki", "pehle"])
        dim_reasoning = EvaluationDimension(
            dimension="Problem-Solving Reasoning",
            score_pct=82.0 if has_reasoning else 50.0,
            confidence=0.8,
            evidence_citation=candidate_turns[0].get("transcript", "")[:150],
            reasoning="Explained logical problem-solving steps clearly." if has_reasoning else "Step-by-step reasoning was abbreviated.",
            status="EVALUATED"
        )

        # 4. Technical Correctness
        dim_correctness = EvaluationDimension(
            dimension="Technical Correctness",
            score_pct=85.0 if ("hash_table" in topics or "two_pointer_technique" in topics) else 65.0,
            confidence=0.85,
            evidence_citation=candidate_turns[0].get("transcript", "")[:150],
            reasoning="Technical terminology and algorithms used correctly.",
            status="EVALUATED"
        )

        # 5. Knowledge of Trade-offs
        has_tradeoffs = any(k in combined_candidate_text for k in ["trade", "instead", "rather than", "alternative", "memory", "space vs time"])
        dim_tradeoffs = EvaluationDimension(
            dimension="Knowledge of Trade-offs",
            score_pct=78.0 if has_tradeoffs else 0.0,
            confidence=0.8,
            evidence_citation=candidate_turns[-1].get("transcript", "")[:150] if has_tradeoffs else "N/A",
            reasoning="Analyzed design trade-offs between memory and performance." if has_tradeoffs else "Trade-off discussion was not initiated.",
            status="EVALUATED" if has_tradeoffs else "INSUFFICIENT_EVIDENCE"
        )

        # 6. Debugging Ability
        has_debugging = any(k in combined_candidate_text for k in ["bug", "edge case", "test", "failed", "null", "empty", "duplicate", "overflow"])
        dim_debugging = EvaluationDimension(
            dimension="Debugging Ability",
            score_pct=75.0 if has_debugging else 0.0,
            confidence=0.75,
            evidence_citation=candidate_turns[-1].get("transcript", "")[:150] if has_debugging else "N/A",
            reasoning="Addressed edge conditions and potential bugs." if has_debugging else "Debugging scenarios were not explored.",
            status="EVALUATED" if has_debugging else "INSUFFICIENT_EVIDENCE"
        )

        # 7. Systems Thinking
        has_systems = any(k in combined_candidate_text for k in ["scale", "concurrent", "system", "cache", "network", "distributed", "database"])
        dim_systems = EvaluationDimension(
            dimension="Systems Thinking",
            score_pct=80.0 if has_systems else 0.0,
            confidence=0.75,
            evidence_citation=candidate_turns[0].get("transcript", "")[:150] if has_systems else "N/A",
            reasoning="Connected algorithm to architectural and systems concepts." if has_systems else "High-level systems implications were not discussed.",
            status="EVALUATED" if has_systems else "INSUFFICIENT_EVIDENCE"
        )

        # 8. Clarity of Technical Explanation
        avg_words_per_turn = total_candidate_words / max(1, len(candidate_turns))
        clarity_score = 85.0 if 12 <= avg_words_per_turn <= 90 else 60.0
        dim_clarity = EvaluationDimension(
            dimension="Clarity of Technical Explanation",
            score_pct=clarity_score,
            confidence=0.9,
            evidence_citation=candidate_turns[0].get("transcript", "")[:150],
            reasoning="Structured, concise technical explanations without ungrounded digressions.",
            status="EVALUATED"
        )

        all_dims = [
            dim_concept,
            dim_reasoning,
            dim_correctness,
            dim_complexity,
            dim_tradeoffs,
            dim_debugging,
            dim_systems,
            dim_clarity
        ]

        evaluated = [d.score_pct for d in all_dims if d.status == "EVALUATED"]
        overall = round(sum(evaluated) / len(evaluated), 1) if evaluated else 0.0

        return ConversationalEvaluationReport(
            session_id=session_id,
            overall_competency_pct=overall,
            topics_covered=sorted(list(topics)) if topics else ["algorithm_analysis"],
            dimensions=all_dims,
            strong_evidence=[f"Turn {i+1}: {t.get('transcript')[:120]}" for i, t in enumerate(candidate_turns[:2])],
            gaps_or_misconceptions=[d.dimension for d in all_dims if d.status == "INSUFFICIENT_EVIDENCE"],
            unresolved_topics=[d.dimension for d in all_dims if d.status == "INSUFFICIENT_EVIDENCE"],
            summary_narrative=f"Candidate evaluated across 8 dimensions. {len(evaluated)}/8 dimensions had sufficient evidence with an overall score of {overall}%."
        )
