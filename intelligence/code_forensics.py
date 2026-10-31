"""
Code Forensics & Structural Similarity Analysis (Section 15).
Implements AST normalization, token-frequency analysis, and structural similarity comparison.
Grounded in reproducible metrics rather than superficial heuristic guesses.
"""

from dataclasses import dataclass
from typing import Dict, List, Tuple, Any
import ast
import re
import math


@dataclass
class SimilarityReport:
    submission_a_id: str
    submission_b_id: str
    overall_similarity: float
    token_overlap: float
    ast_structural_similarity: float
    shared_structure_details: List[str]
    is_suspicious_collusion: bool


class CodeForensicsEngine:
    def __init__(self):
        pass

    def normalize_python_code(self, source: str) -> Tuple[str, List[str]]:
        """
        Parses Python code into an AST, normalizes variable names to generic v0, v1,
        and extracts structural node sequences.
        """
        try:
            tree = ast.parse(source)
        except SyntaxError:
            # Fallback to lexical normalization if code has partial syntax errors
            return self._lexical_normalize(source)

        node_types = []
        for node in ast.walk(tree):
            node_types.append(type(node).__name__)

        # Replace all variable names with vN
        class VariableRenamer(ast.NodeTransformer):
            def __init__(self):
                self.mapping = {}
                self.counter = 0

            def visit_Name(self, node):
                if node.id not in self.mapping:
                    self.mapping[node.id] = f"v_{self.counter}"
                    self.counter += 1
                node.id = self.mapping[node.id]
                return node

        renamed = VariableRenamer().visit(tree)
        ast.fix_missing_locations(renamed)
        try:
            normalized_source = ast.unparse(renamed)
        except Exception:
            normalized_source = source

        return normalized_source, node_types

    def _lexical_normalize(self, source: str) -> Tuple[str, List[str]]:
        tokens = re.findall(r'[a-zA-Z_]\w*|\d+|[^\w\s]', source)
        return " ".join(tokens), tokens

    def compare_submissions(self, sub_a_id: str, code_a: str,
                            sub_b_id: str, code_b: str, lang: str = "python") -> SimilarityReport:
        norm_a, nodes_a = self.normalize_python_code(code_a)
        norm_b, nodes_b = self.normalize_python_code(code_b)

        # 1. AST Structural Similarity via Jaccard index on n-grams of AST nodes
        ast_sim = self._ngram_jaccard(nodes_a, nodes_b, n=3)

        # 2. Tokenized code overlap (bag-of-words cosine similarity)
        tokens_a = re.findall(r'\w+|[^\w\s]', norm_a)
        tokens_b = re.findall(r'\w+|[^\w\s]', norm_b)
        token_sim = self._token_cosine(tokens_a, tokens_b)

        # Combined structural score
        overall = 0.6 * ast_sim + 0.4 * token_sim

        details = []
        if ast_sim > 0.80:
            details.append(f"High AST structure parity ({ast_sim:.2%}): isomorphic control flow and loop constructs.")
        if token_sim > 0.80:
            details.append(f"High normalized token overlap ({token_sim:.2%}): equivalent operator & literal sequence.")

        is_collusion = overall >= 0.80

        return SimilarityReport(
            submission_a_id=sub_a_id,
            submission_b_id=sub_b_id,
            overall_similarity=round(overall, 4),
            token_overlap=round(token_sim, 4),
            ast_structural_similarity=round(ast_sim, 4),
            shared_structure_details=details,
            is_suspicious_collusion=is_collusion
        )

    def _ngram_jaccard(self, seq_a: List[str], seq_b: List[str], n: int = 3) -> float:
        if len(seq_a) < n or len(seq_b) < n:
            return 1.0 if seq_a == seq_b else 0.0

        ngrams_a = set(tuple(seq_a[i:i+n]) for i in range(len(seq_a) - n + 1))
        ngrams_b = set(tuple(seq_b[i:i+n]) for i in range(len(seq_b) - n + 1))

        inter = len(ngrams_a & ngrams_b)
        union = len(ngrams_a | ngrams_b)
        return inter / union if union > 0 else 0.0

    def _token_cosine(self, tokens_a: List[str], tokens_b: List[str]) -> float:
        freq_a: Dict[str, int] = {}
        freq_b: Dict[str, int] = {}
        for t in tokens_a:
            freq_a[t] = freq_a.get(t, 0) + 1
        for t in tokens_b:
            freq_b[t] = freq_b.get(t, 0) + 1

        all_keys = set(freq_a.keys()) | set(freq_b.keys())
        dot = sum(freq_a.get(k, 0) * freq_b.get(k, 0) for k in all_keys)
        mag_a = math.sqrt(sum(v * v for v in freq_a.values()))
        mag_b = math.sqrt(sum(v * v for v in freq_b.values()))

        if mag_a == 0 or mag_b == 0:
            return 0.0
        return dot / (mag_a * mag_b)
