"""
Nomic Text Embedding Provider.
Interacts with local nomic-embed-text:latest via Ollama /api/embed.
Enforces the mandatory Nomic task prefixes ("search_document: " vs "search_query: ")
to generate high-accuracy 768-dimensional dense vector embeddings.
"""

import requests
from typing import List, Union, Dict, Any, Optional
from local_ai.config.settings import settings

class NomicEmbeddingProvider:
    def __init__(self, base_url: Optional[str] = None):
        self.base_url = base_url or settings.OLLAMA_BASE_URL
        self.model = settings.EMBEDDING_MODEL

    def embed(
        self,
        texts: Union[str, List[str]],
        task_type: str = "document"  # "document" or "query"
    ) -> List[List[float]]:
        """
        Generates 768-dimensional dense vector embeddings.
        Automatically prefixes texts:
        - "search_document: <text>" for documents / indexed code / transcripts
        - "search_query: <text>" for queries / semantic search
        """
        if isinstance(texts, str):
            input_texts = [texts]
        else:
            input_texts = list(texts)

        prefix = "search_query: " if task_type.lower() == "query" else "search_document: "
        prefixed_inputs = [
            t if t.startswith("search_") else f"{prefix}{t}"
            for t in input_texts
        ]

        payload = {
            "model": self.model,
            "input": prefixed_inputs
        }

        resp = requests.post(f"{self.base_url}/api/embed", json=payload, timeout=30.0)
        if resp.status_code != 200:
            raise RuntimeError(f"Ollama embed error ({resp.status_code}): {resp.text}")

        data = resp.json()
        embeddings = data.get("embeddings", [])
        return embeddings

    def embed_single(self, text: str, task_type: str = "document") -> List[float]:
        """Convenience method for single string embedding."""
        res = self.embed(text, task_type=task_type)
        return res[0] if res else []


nomic_embedding_provider = NomicEmbeddingProvider()
