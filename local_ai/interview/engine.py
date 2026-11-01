"""
Conversational Engine for InterviewOS.
Implements the continuous interview lifecycle, intent detection,
adaptive question generation, and conversation summarization.
"""

import re
from typing import Dict, List, Optional, Any
from intelligence.interviewer import MultilingualInterviewer, InterviewTurn
from local_ai.interview.context_builder import InterviewContext, ContextBuilder
from local_ai.providers.ollama_provider import ollama_provider
from local_ai.routing.model_router import model_router


class ConversationalEngine:
    def __init__(self):
        self.multilingual = MultilingualInterviewer()

    def detect_intent(self, transcript: str) -> str:
        """
        Detects specific candidate conversational intents:
        - STOP: Candidate explicitly requested to stop/finish/end the interview.
        - CANCEL: Candidate explicitly requested to cancel the interview.
        - REPEAT: Candidate asked to repeat or speak more slowly.
        - THINKING: Candidate requested a moment to think.
        - CLARIFY: Candidate asked for question clarification.
        - NORMAL: Standard technical response.
        """
        text = transcript.lower().strip()
        
        # Explicit Stop Intent
        stop_patterns = [
            r"\bstop the interview\b",
            r"\bend the interview\b",
            r"\bend this interview\b",
            r"\bi want to finish\b",
            r"\bi am done with the interview\b",
            r"\bthat is all for now\b",
            r"\blet's stop here\b"
        ]
        if any(re.search(p, text) for p in stop_patterns):
            return "STOP"

        # Explicit Cancel Intent
        cancel_patterns = [
            r"\bcancel the interview\b",
            r"\bcancel this assessment\b",
            r"\bi want to cancel\b",
            r"\babort interview\b"
        ]
        if any(re.search(p, text) for p in cancel_patterns):
            return "CANCEL"

        # Repeat Intent
        if any(phrase in text for phrase in ["can you repeat", "repeat that", "say that again", "speak more slowly", "repeat the question"]):
            return "REPEAT"

        # Thinking Intent
        if any(phrase in text for phrase in ["let me think", "give me a moment", "one second please", "give me a second", "thinking about it"]):
            return "THINKING"

        # Clarify Intent
        if any(phrase in text for phrase in ["can you explain the question", "what do you mean", "could you clarify", "clarify the question"]):
            return "CLARIFY"

        return "NORMAL"

    def process_turn_and_generate_response(
        self,
        ctx: InterviewContext,
        candidate_utterance: str,
        conversation_history: List[Dict[str, str]]
    ) -> Dict[str, Any]:
        """
        Processes candidate verbal turn:
        1. Detects language (en, hi, hinglish) & technical concepts.
        2. Detects candidate intent (STOP, CANCEL, REPEAT, THINKING, CLARIFY, NORMAL).
        3. Invokes local reasoning model to generate adaptive follow-up.
        """
        turn = self.multilingual.process_candidate_turn(
            session_id=ctx.session_id,
            turn_id=f"turn-{len(conversation_history) + 1}",
            raw_transcript=candidate_utterance
        )

        intent = self.detect_intent(candidate_utterance)

        if intent == "STOP":
            reply = "Understood. Thank you for walking through your solution and trade-offs. We are concluding the interview now."
            return {
                "turn": turn,
                "intent": intent,
                "response_text": reply,
                "action": "END_INTERVIEW"
            }

        if intent == "CANCEL":
            reply = "The interview has been cancelled per your request. Your prior finalized responses will be archived."
            return {
                "turn": turn,
                "intent": intent,
                "response_text": reply,
                "action": "CANCEL_INTERVIEW"
            }

        if intent == "REPEAT":
            # Find last interviewer question
            last_q = next((m["content"] for m in reversed(conversation_history) if m.get("role") == "assistant"), "Could you walk me through your solution?")
            reply = f"Certainly. Let me repeat: {last_q}"
            return {
                "turn": turn,
                "intent": intent,
                "response_text": reply,
                "action": "CONTINUE"
            }

        if intent == "THINKING":
            reply = "Take your time. Whenever you are ready, feel free to share your thought process."
            return {
                "turn": turn,
                "intent": intent,
                "response_text": reply,
                "action": "CONTINUE"
            }

        # Build prompt for adaptive conversational LLM
        system_prompt = ContextBuilder.build_interviewer_system_prompt(ctx)
        
        # Build message history with bounded window (last 6 turns, avoiding duplicates of latest candidate utterance)
        messages = [{"role": "system", "content": system_prompt}]
        for msg in conversation_history[-6:]:
            content = msg.get("content", "").strip()
            # If the last item in conversation_history already has this exact utterance, don't duplicate
            if content and content != candidate_utterance.strip():
                messages.append({"role": msg.get("role", "user"), "content": content})
        messages.append({"role": "user", "content": candidate_utterance})

        try:
            resolved_model = model_router.resolve_model("interview_followup")
            llm_res = ollama_provider.chat(
                model=resolved_model,
                messages=messages,
                temperature=0.2,
                num_ctx=4096
            )
            response_text = llm_res["content"].strip()
            # Clean any markdown block formatting or quotes
            response_text = re.sub(r'^["\']|["\']$', '', response_text)
        except Exception:
            # Fallback to rule-based multilingual interviewer logic
            response_text = self.multilingual.generate_followup_question(turn, ctx.problem_statement)

        return {
            "turn": turn,
            "intent": intent,
            "response_text": response_text,
            "action": "CONTINUE"
        }
