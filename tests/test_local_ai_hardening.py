"""
Unit and Integration Tests for Local AI Hardening.
Verifies model allowlist validation, rejection of non-local models,
multilingual voice checks, and failure handling.
"""

import pytest
from fastapi.testclient import TestClient
from local_ai.main import app
from local_ai.routing.model_router import model_router


def test_model_router_allowlist_enforcement():
    """Valid models succeed, non-allowlisted models raise ValueError."""
    # Allowed models
    assert model_router.resolve_model(requested_model="qwen2.5-coder:3b") == "qwen2.5-coder:3b"
    assert model_router.resolve_model(requested_model="granite4.1:3b") == "granite4.1:3b"

    # Unauthorized/cloud models must be rejected
    with pytest.raises(ValueError) as excinfo:
        model_router.resolve_model(requested_model="gpt-4o")
    assert "not permitted in local-first allowlist" in str(excinfo.value)

    with pytest.raises(ValueError):
        model_router.resolve_model(requested_model="claude-3-opus")


def test_chat_endpoint_invalid_model_rejection():
    """POST /chat with an unauthorized model returns 400 Bad Request."""
    client = TestClient(app)
    req = {
        "messages": [{"role": "user", "content": "hi"}],
        "model": "unapproved-cloud-model"
    }
    response = client.post("/chat", json=req)
    assert response.status_code == 400
    assert "INVALID_MODEL" in response.json()["detail"]


def test_synthesize_endpoint_multilingual_voice_validation():
    """POST /synthesize with unsupported language returns 422 MULTILINGUAL_VOICE_UNAVAILABLE."""
    client = TestClient(app)
    req = {
        "text": "नमस्ते",
        "language": "hi_IN"
    }
    response = client.post("/synthesize", json=req)
    assert response.status_code == 422
    assert "MULTILINGUAL_VOICE_UNAVAILABLE" in response.json()["detail"]


def test_health_endpoint_structure():
    """GET /health reports offline mode and active model/hardware probes."""
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "100% Offline / Local-First"
    assert data["allow_cloud_ai"] is False
    assert "gpu_vram" in data
