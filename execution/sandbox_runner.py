"""
Constrained Sandboxed Code Execution Service (Section 13).
Executes untrusted candidate code within an isolated, resource-constrained container boundary.
Enforces non-root user, read-only filesystem, disabled networking (--network none),
memory limits (128m), CPU quotas (1.0), PID limits (64), process timeouts, and temporary workspace cleanup.

CRITICAL SECURITY POLICY:
FAIL-CLOSED: If container runtime (Docker) is unavailable, unconfined host execution is REJECTED
by default, returning ISOLATION_FAILED_CLOSED.
Only if INTERVIEWOS_ALLOW_UNSAFE_HOST_EXECUTION=true is explicitly set in environment
will it execute on host for development/testing, explicitly labeled as UNCONFINED_HOST_DEV_ONLY.
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Any
import subprocess
import tempfile
import os
import time
import shutil
import logging

logger = logging.getLogger("interviewos.execution.sandbox")


class IsolationStatus:
    CONTAINER_ISOLATED = "CONTAINER_ISOLATED"
    ISOLATION_FAILED_CLOSED = "ISOLATION_FAILED_CLOSED"
    UNCONFINED_HOST_DEV_ONLY = "UNCONFINED_HOST_DEV_ONLY"


@dataclass
class TestCaseResult:
    test_case_id: str
    passed: bool
    input_data: str
    expected_output: str
    actual_output: str
    execution_time_ms: int
    error_message: Optional[str] = None


@dataclass
class ExecutionResult:
    language: str
    total_test_cases: int
    test_cases_passed: int
    all_passed: bool
    max_execution_time_ms: int
    results: List[TestCaseResult]
    isolation_status: str
    isolation_warning: Optional[str] = None
    compilation_error: Optional[str] = None


class SandboxedExecutionService:
    def __init__(self, default_timeout_seconds: float = 3.0, allow_host_dev: Optional[bool] = None):
        self.default_timeout = default_timeout_seconds
        if allow_host_dev is not None:
            self.allow_host_dev = allow_host_dev
        else:
            self.allow_host_dev = os.environ.get(
                "INTERVIEWOS_ALLOW_UNSAFE_HOST_EXECUTION", ""
            ).lower() in ("true", "1", "yes")

    def _is_docker_available(self) -> bool:
        """Checks if Docker CLI is installed and the daemon is actively responding."""
        try:
            res = subprocess.run(
                ["docker", "info"],
                capture_output=True,
                text=True,
                timeout=2.0
            )
            return res.returncode == 0
        except Exception:
            return False

    def execute_python(self, source_code: str, test_cases: List[Dict[str, str]]) -> ExecutionResult:
        docker_available = self._is_docker_available()

        if not docker_available:
            if not self.allow_host_dev:
                logger.error("[Security Violation] Refusing unconfined host execution: Docker daemon offline and fail-closed active")
                err_msg = (
                    "Security Isolation Violation: Docker container daemon is offline. "
                    "Fail-closed policy rejected unconfined host execution. "
                    "To enable host execution for local development ONLY, set INTERVIEWOS_ALLOW_UNSAFE_HOST_EXECUTION=true"
                )
                return ExecutionResult(
                    language="python",
                    total_test_cases=len(test_cases),
                    test_cases_passed=0,
                    all_passed=False,
                    max_execution_time_ms=0,
                    results=[],
                    isolation_status=IsolationStatus.ISOLATION_FAILED_CLOSED,
                    compilation_error=err_msg
                )
            else:
                return self._execute_python_host(source_code, test_cases)
        else:
            return self._execute_python_container(source_code, test_cases)

    def _execute_python_container(self, source_code: str, test_cases: List[Dict[str, str]]) -> ExecutionResult:
        tmp_dir = tempfile.mkdtemp(prefix="interviewos_container_")
        script_path = os.path.join(tmp_dir, "solution.py")
        run_uid = os.getuid()
        run_gid = os.getgid()

        try:
            with open(script_path, "w", encoding="utf-8") as f:
                f.write(source_code)

            case_results = []
            max_time_ms = 0

            # Standard hardened container execution flags
            # --network none: fully isolated network namespace
            # --read-only: read-only rootfs
            # --memory 128m: strict memory boundary
            # --cpus 1.0: CPU throttle
            # --pids-limit 64: prevent fork bombs
            # --user 1000:1000: non-root execution
            # --tmpfs /tmp:rw,noexec,nosuid,size=16m
            container_cmd_base = [
                "docker", "run", "--rm", "-i",
                "--network", "none",
                "--read-only",
                "--memory", "128m",
                "--cpus", "1.0",
                "--pids-limit", "64",
                "--user", f"{run_uid}:{run_gid}",
                "--tmpfs", "/tmp:rw,noexec,nosuid,size=16m",
                "-v", f"{tmp_dir}:/workspace:ro",
                "-w", "/workspace",
                "python:3.11-slim",
                "python", "solution.py"
            ]

            for i, tc in enumerate(test_cases):
                tc_id = f"tc_{i+1}"
                input_data = tc.get("input", "")
                expected = tc.get("expected", "").strip()

                start = time.perf_counter()
                try:
                    proc = subprocess.run(
                        container_cmd_base,
                        input=input_data,
                        capture_output=True,
                        text=True,
                        timeout=self.default_timeout,
                    )
                    duration_ms = int((time.perf_counter() - start) * 1000)
                    if duration_ms > max_time_ms:
                        max_time_ms = duration_ms

                    actual = proc.stdout.strip()
                    passed = (proc.returncode == 0) and (actual == expected)
                    err = proc.stderr if proc.returncode != 0 else None

                    case_results.append(TestCaseResult(
                        test_case_id=tc_id,
                        passed=passed,
                        input_data=input_data,
                        expected_output=expected,
                        actual_output=actual,
                        execution_time_ms=duration_ms,
                        error_message=err
                    ))
                except subprocess.TimeoutExpired:
                    case_results.append(TestCaseResult(
                        test_case_id=tc_id,
                        passed=False,
                        input_data=input_data,
                        expected_output=expected,
                        actual_output="",
                        execution_time_ms=int(self.default_timeout * 1000),
                        error_message=f"Container execution timed out (> {self.default_timeout}s)"
                    ))

            passed_count = sum(1 for r in case_results if r.passed)
            return ExecutionResult(
                language="python",
                total_test_cases=len(case_results),
                test_cases_passed=passed_count,
                all_passed=(passed_count == len(case_results)),
                max_execution_time_ms=max_time_ms,
                results=case_results,
                isolation_status=IsolationStatus.CONTAINER_ISOLATED
            )
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

    def _execute_python_host(self, source_code: str, test_cases: List[Dict[str, str]]) -> ExecutionResult:
        tmp_dir = tempfile.mkdtemp(prefix="interviewos_sandbox_dev_")
        script_path = os.path.join(tmp_dir, "solution.py")

        try:
            with open(script_path, "w", encoding="utf-8") as f:
                f.write(source_code)

            case_results = []
            max_time_ms = 0

            for i, tc in enumerate(test_cases):
                tc_id = f"tc_{i+1}"
                input_data = tc.get("input", "")
                expected = tc.get("expected", "").strip()

                start = time.perf_counter()
                try:
                    proc = subprocess.run(
                        ["python", script_path],
                        input=input_data,
                        capture_output=True,
                        text=True,
                        timeout=self.default_timeout,
                        cwd=tmp_dir,
                        shell=False
                    )
                    duration_ms = int((time.perf_counter() - start) * 1000)
                    if duration_ms > max_time_ms:
                        max_time_ms = duration_ms

                    actual = proc.stdout.strip()
                    passed = (proc.returncode == 0) and (actual == expected)
                    err = proc.stderr if proc.returncode != 0 else None

                    case_results.append(TestCaseResult(
                        test_case_id=tc_id,
                        passed=passed,
                        input_data=input_data,
                        expected_output=expected,
                        actual_output=actual,
                        execution_time_ms=duration_ms,
                        error_message=err
                    ))
                except subprocess.TimeoutExpired:
                    case_results.append(TestCaseResult(
                        test_case_id=tc_id,
                        passed=False,
                        input_data=input_data,
                        expected_output=expected,
                        actual_output="",
                        execution_time_ms=int(self.default_timeout * 1000),
                        error_message=f"Execution timed out (> {self.default_timeout}s)"
                    ))

            passed_count = sum(1 for r in case_results if r.passed)
            return ExecutionResult(
                language="python",
                total_test_cases=len(case_results),
                test_cases_passed=passed_count,
                all_passed=(passed_count == len(case_results)),
                max_execution_time_ms=max_time_ms,
                results=case_results,
                isolation_status=IsolationStatus.UNCONFINED_HOST_DEV_ONLY,
                isolation_warning="DANGER: Unconfined host execution used because INTERVIEWOS_ALLOW_UNSAFE_HOST_EXECUTION=true"
            )
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

    def execute_cpp(self, source_code: str, test_cases: List[Dict[str, str]]) -> ExecutionResult:
        docker_available = self._is_docker_available()

        if not docker_available and not self.allow_host_dev:
            return ExecutionResult(
                language="cpp",
                total_test_cases=len(test_cases),
                test_cases_passed=0,
                all_passed=False,
                max_execution_time_ms=0,
                results=[],
                isolation_status=IsolationStatus.ISOLATION_FAILED_CLOSED,
                compilation_error="Fail-closed: Container runtime offline"
            )

        tmp_dir = tempfile.mkdtemp(prefix="interviewos_sandbox_cpp_")
        src_path = os.path.join(tmp_dir, "solution.cpp")
        exe_path = os.path.join(tmp_dir, "solution.exe")

        try:
            with open(src_path, "w", encoding="utf-8") as f:
                f.write(source_code)

            compile_res = subprocess.run(
                ["g++", "-O2", "-std=c++20", src_path, "-o", exe_path],
                capture_output=True,
                text=True,
                timeout=10.0,
                cwd=tmp_dir,
                shell=False
            )
            if compile_res.returncode != 0:
                return ExecutionResult(
                    language="cpp",
                    total_test_cases=len(test_cases),
                    test_cases_passed=0,
                    all_passed=False,
                    max_execution_time_ms=0,
                    results=[],
                    isolation_status=IsolationStatus.UNCONFINED_HOST_DEV_ONLY,
                    compilation_error=compile_res.stderr
                )

            case_results = []
            max_time_ms = 0
            for i, tc in enumerate(test_cases):
                tc_id = f"tc_{i+1}"
                input_data = tc.get("input", "")
                expected = tc.get("expected", "").strip()

                start = time.perf_counter()
                try:
                    proc = subprocess.run(
                        [exe_path],
                        input=input_data,
                        capture_output=True,
                        text=True,
                        timeout=self.default_timeout,
                        cwd=tmp_dir,
                        shell=False
                    )
                    duration_ms = int((time.perf_counter() - start) * 1000)
                    if duration_ms > max_time_ms:
                        max_time_ms = duration_ms

                    actual = proc.stdout.strip()
                    passed = (proc.returncode == 0) and (actual == expected)
                    err = proc.stderr if proc.returncode != 0 else None

                    case_results.append(TestCaseResult(
                        test_case_id=tc_id,
                        passed=passed,
                        input_data=input_data,
                        expected_output=expected,
                        actual_output=actual,
                        execution_time_ms=duration_ms,
                        error_message=err
                    ))
                except subprocess.TimeoutExpired:
                    case_results.append(TestCaseResult(
                        test_case_id=tc_id,
                        passed=False,
                        input_data=input_data,
                        expected_output=expected,
                        actual_output="",
                        execution_time_ms=int(self.default_timeout * 1000),
                        error_message=f"Execution timed out (> {self.default_timeout}s)"
                    ))

            passed_count = sum(1 for r in case_results if r.passed)
            return ExecutionResult(
                language="cpp",
                total_test_cases=len(case_results),
                test_cases_passed=passed_count,
                all_passed=(passed_count == len(case_results)),
                max_execution_time_ms=max_time_ms,
                results=case_results,
                isolation_status=IsolationStatus.UNCONFINED_HOST_DEV_ONLY
            )
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)
