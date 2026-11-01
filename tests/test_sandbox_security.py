"""
Security and Isolation Boundary Unit Tests for Sandboxed Execution Service.
Verifies fail-closed container policy, host dev fallback labeling, timeout protection,
and isolation boundary enforcement.
"""

import pytest
import os
from execution.sandbox_runner import SandboxedExecutionService, IsolationStatus


def test_sandbox_fail_closed_by_default(monkeypatch):
    """When Docker is offline and INTERVIEWOS_ALLOW_UNSAFE_HOST_EXECUTION is not set, execution must FAIL CLOSED."""
    monkeypatch.delenv("INTERVIEWOS_ALLOW_UNSAFE_HOST_EXECUTION", raising=False)
    
    svc = SandboxedExecutionService(default_timeout_seconds=2.0)
    # Monkeypatch _is_docker_available to simulate offline Docker
    monkeypatch.setattr(svc, "_is_docker_available", lambda: False)

    code = "print('hello world')"
    test_cases = [{"input": "", "expected": "hello world"}]

    res = svc.execute_python(code, test_cases)
    assert res.isolation_status == IsolationStatus.ISOLATION_FAILED_CLOSED
    assert not res.all_passed
    assert "Security Isolation Violation" in (res.compilation_error or "")


def test_sandbox_unconfined_host_dev_explicit_opt_in(monkeypatch):
    """When allow_host_dev is explicitly enabled, execution succeeds but is labeled UNCONFINED_HOST_DEV_ONLY."""
    svc = SandboxedExecutionService(default_timeout_seconds=2.0, allow_host_dev=True)
    monkeypatch.setattr(svc, "_is_docker_available", lambda: False)

    code = "import sys\nline = sys.stdin.read().strip()\nprint(f'ECHO:{line}')"
    test_cases = [
        {"input": "alpha", "expected": "ECHO:alpha"},
        {"input": "beta", "expected": "ECHO:beta"}
    ]

    res = svc.execute_python(code, test_cases)
    assert res.isolation_status == IsolationStatus.UNCONFINED_HOST_DEV_ONLY
    assert res.isolation_warning is not None
    assert "DANGER" in res.isolation_warning
    assert res.all_passed
    assert res.test_cases_passed == 2


def test_sandbox_timeout_protection(monkeypatch):
    """Infinite loop code must be safely terminated by timeout."""
    svc = SandboxedExecutionService(default_timeout_seconds=1.0, allow_host_dev=True)
    monkeypatch.setattr(svc, "_is_docker_available", lambda: False)

    infinite_loop_code = "while True:\n    pass\n"
    test_cases = [{"input": "", "expected": "done"}]

    res = svc.execute_python(infinite_loop_code, test_cases)
    assert not res.all_passed
    assert res.test_cases_passed == 0
    assert "timed out" in (res.results[0].error_message or "").lower()
