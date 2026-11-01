"""
Interview Context Builder for InterviewOS.
Extracts and structures candidate resume (PDF/DOCX), coding challenge,
submitted code, test outcomes, and conversation turns into bounded context.
"""

import io
import re
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field


class ResumeExtraction(BaseModel):
    name: Optional[str] = None
    summary: Optional[str] = None
    technologies: List[str] = Field(default_factory=list)
    projects: List[Dict[str, Any]] = Field(default_factory=list)
    experience: List[Dict[str, Any]] = Field(default_factory=list)
    education: List[str] = Field(default_factory=list)
    raw_text: str = ""


class InterviewContext(BaseModel):
    session_id: str
    problem_statement: str
    constraints: List[str] = Field(default_factory=list)
    candidate_code: Optional[str] = None
    language: Optional[str] = "python"
    test_results: Optional[Dict[str, Any]] = None
    resume: Optional[ResumeExtraction] = None
    conversation_summary: str = ""
    topics_covered: List[str] = Field(default_factory=list)
    current_difficulty: str = "medium"


class ContextBuilder:
    """Safely processes uploaded resumes and compiles bounded LLM prompts."""

    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

    @staticmethod
    def extract_resume_from_bytes(content: bytes, filename: str) -> ResumeExtraction:
        if len(content) > ContextBuilder.MAX_FILE_SIZE:
            raise ValueError(f"Resume exceeds maximum allowed size of 5MB ({len(content)} bytes)")

        raw_text = ""
        filename_lower = filename.lower()

        if filename_lower.endswith(".pdf"):
            try:
                import pypdf
                reader = pypdf.PdfReader(io.BytesIO(content))
                text_parts = []
                for page in reader.pages:
                    extracted = page.extract_text()
                    if extracted:
                        text_parts.append(extracted)
                raw_text = "\n".join(text_parts)
            except Exception as e:
                raise ValueError(f"Failed to parse PDF resume: {str(e)}")
        elif filename_lower.endswith(".docx"):
            try:
                import docx
                doc = docx.Document(io.BytesIO(content))
                text_parts = [p.text for p in doc.paragraphs if p.text.strip()]
                raw_text = "\n".join(text_parts)
            except Exception as e:
                raise ValueError(f"Failed to parse DOCX resume: {str(e)}")
        elif filename_lower.endswith(".txt"):
            raw_text = content.decode("utf-8", errors="ignore")
        else:
            raise ValueError("Unsupported resume format. Please provide a PDF, DOCX, or TXT file.")

        raw_text = raw_text.strip()
        if not raw_text:
            return ResumeExtraction(raw_text="")

        # Basic tech stack and section extraction
        tech_keywords = [
            "python", "go", "golang", "c++", "cpp", "c", "rust", "java", "javascript", "typescript",
            "react", "vue", "angular", "node", "fastapi", "django", "flask", "docker", "kubernetes",
            "postgres", "postgresql", "mysql", "redis", "mongodb", "kafka", "aws", "gcp", "azure",
            "grpc", "rest", "graphql", "git", "linux", "distributed systems", "microservices"
        ]
        found_tech = []
        lower_raw = raw_text.lower()
        for tk in tech_keywords:
            if re.search(r'\b' + re.escape(tk) + r'\b', lower_raw):
                found_tech.append(tk)

        # Detect potential project/experience snippets
        lines = [line.strip() for line in raw_text.split("\n") if line.strip()]
        projects = []
        for line in lines:
            if any(term in line.lower() for term in ["built", "designed", "engineered", "implemented", "developed", "architected"]):
                if len(line) > 20 and len(line) < 300:
                    projects.append({"summary": line})
                    if len(projects) >= 5:
                        break

        return ResumeExtraction(
            technologies=sorted(list(set(found_tech))),
            projects=projects,
            raw_text=raw_text[:8000]  # Bounded to avoid prompt bloat
        )

    @staticmethod
    def build_interviewer_system_prompt(ctx: InterviewContext) -> str:
        """
        Builds a concise, professional system prompt that embodies the InterviewOS persona:
        - Calm, curious, technically rigorous, respectful, adaptive.
        - Asks one main question at a time.
        - Strictly avoids lengthy monologues or generic praise.
        - Decouples technical assessment from biased biometrics.
        """
        parts = [
            "You are an expert technical interviewer conducting a live conversational voice interview for InterviewOS.",
            "Your objective is to assess the candidate's engineering reasoning, system understanding, and implementation trade-offs.",
            "",
            "RULES OF ENGAGEMENT:",
            "1. Ask ONE concise, specific question at a time. Maximum 2-3 sentences.",
            "2. Never give long lectures or repeat praise like 'Great job!' or 'Awesome!'. Maintain a professional, collaborative tone.",
            "3. Build directly on the candidate's previous response. Challenge incorrect reasoning respectfully.",
            "4. Match the candidate's conversational language (English, Hindi, or Hinglish) naturally while preserving technical terms (e.g. 'hash table', 'time complexity', 'mutex').",
            "5. If candidate says explicitly 'stop the interview', 'cancel the interview', or 'finish', acknowledge gracefully.",
            "6. Never reveal internal scoring rubrics, hidden unit test details, or exact reference solutions."
        ]

        parts.append(f"\nASSESSMENT PROBLEM:\n{ctx.problem_statement}")
        if ctx.constraints:
            parts.append("Constraints: " + "; ".join(ctx.constraints))

        if ctx.candidate_code:
            parts.append(f"\nCANDIDATE CODE ({ctx.language}):\n```\n{ctx.candidate_code[:2000]}\n```")

        if ctx.test_results:
            passed = ctx.test_results.get("test_cases_passed", 0)
            total = ctx.test_results.get("total_test_cases", 0)
            parts.append(f"EXECUTION OUTCOME: {passed}/{total} test cases passed.")

        if ctx.resume and ctx.resume.raw_text:
            parts.append("\nCANDIDATE BACKGROUND / RESUME SNIPPET:")
            if ctx.resume.technologies:
                parts.append("Key Technologies: " + ", ".join(ctx.resume.technologies[:12]))
            if ctx.resume.projects:
                parts.append("Highlighted Experience: " + "; ".join(p.get("summary", "") for p in ctx.resume.projects[:3]))

        if ctx.conversation_summary:
            parts.append(f"\nCONVERSATION HISTORY SUMMARY:\n{ctx.conversation_summary}")

        return "\n".join(parts)
