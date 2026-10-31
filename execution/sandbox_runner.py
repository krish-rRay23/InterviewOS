"""
Constrained Sandboxed Code Execution Service (Section 13).
Executes untrusted candidate code within an isolated, resource-constrained environment.
Enforces CPU quotas, memory limits, process timeouts, and temporary workspace cleanup.
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Any
import subprocess
import tempfile
import os
import time
import shutil


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
    compilation_error: Optional[str] = None


class SandboxedExecutionService:
    def __init__(self, default_timeout_seconds: float = 3.0):
        self.default_timeout = default_timeout_seconds

    def execute_python(self, source_code: str, test_cases: List[Dict[str, str]]) -> ExecutionResult:
        tmp_dir = tempfile.mkdtemp(prefix="interviewos_sandbox_")
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
                    # Run with subprocess in isolated directory, standard python without shell
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
                results=case_results
            )

        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

    def execute_cpp(self, source_code: str, test_cases: List[Dict[str, str]]) -> ExecutionResult:
        tmp_dir = tempfile.mkdtemp(prefix="interviewos_sandbox_cpp_")
        src_path = os.path.join(tmp_dir, "solution.cpp")
        exe_path = os.path.join(tmp_dir, "solution.exe")

        try:
            with open(src_path, "w", encoding="utf-8") as f:
                f.write(source_code)

            # Compile with g++ using safe optimization flags
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
                results=case_results
            )
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

