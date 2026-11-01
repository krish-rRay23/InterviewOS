"""
SWE-Bench Pro Protocol (Track A3 - Local Smoke Test Subset).
Evaluates patch integrity, fail-to-pass test resolution, and pass-to-pass regression avoidance.

DISCLOSURE:
The official SWE-Bench Pro V2 benchmark comprises 642 tasks across 11 repositories running in
isolated Docker containers with network fencing. This module implements a 3-task local verification
subset adhering to the SWE-Bench evaluation protocol (fail-to-pass and pass-to-pass requirements).
It must NOT be cited as full official SWE-Bench Pro benchmark performance.
"""

from dataclasses import dataclass
from typing import List, Dict, Any
import time


@dataclass
class SWEIssue:
    issue_id: str
    repo: str
    description: str
    base_code: str
    patch_code: str
    regression_tests: List[str]  # Pass-to-pass tests (must pass before and after)
    issue_tests: List[str]       # Fail-to-pass tests (must fail before patch, pass after patch)


SWE_BENCH_ISSUES: List[SWEIssue] = [
    SWEIssue(
        issue_id="SWE-01-OFF-BY-ONE-PAGINATION",
        repo="interviewos/session-service",
        description="Fix off-by-one error where limit=10 returns 11 items when cursor is at exact boundary.",
        base_code="""
def paginate_records(items, cursor, limit):
    start = 0
    if cursor is not None and cursor in items:
        start = items.index(cursor)
    # Bug: <= limit returns limit + 1 items
    return items[start : start + limit + 1]
""",
        patch_code="""
def paginate_records(items, cursor, limit):
    start = 0
    if cursor is not None and cursor in items:
        start = items.index(cursor)
    # Fix: slicing with limit returns exactly limit items
    return items[start : start + limit]
""",
        regression_tests=["paginate_records(list(range(20)), 0, 5) is not None"],
        issue_tests=["len(paginate_records(list(range(20)), 0, 5)) == 5", "len(paginate_records(list(range(20)), 5, 10)) == 10"]
    ),
    SWEIssue(
        issue_id="SWE-02-NULL-POINTER-TELEMETRY",
        repo="interviewos/agent-telemetry",
        description="Prevent AttributeError crash when telemetry payload contains null device metadata.",
        base_code="""
def parse_telemetry(payload):
    dev = payload.get("device")
    # Bug: crashes if dev is None
    return {"device_name": dev["name"], "vendor": dev["vendor"]}
""",
        patch_code="""
def parse_telemetry(payload):
    dev = payload.get("device") or {}
    return {"device_name": dev.get("name", "Unknown"), "vendor": dev.get("vendor", "Generic")}
""",
        regression_tests=["parse_telemetry({'device': {'name': 'Cam', 'vendor': 'Logi'}})['device_name'] == 'Cam'"],
        issue_tests=["parse_telemetry({})['device_name'] == 'Unknown'", "parse_telemetry({'device': None})['vendor'] == 'Generic'"]
    ),
    SWEIssue(
        issue_id="SWE-03-NONCE-REUSE-WINDOW",
        repo="interviewos/crypto-runtime",
        description="Enforce monotonic timestamp window rejection to prevent nonce replay window race.",
        base_code="""
class NonceGate:
    def __init__(self): self.seen = set()
    def check(self, nonce, ts, now):
        # Bug: allows re-using nonce if timestamp is in future
        if nonce in self.seen and ts <= now: return False
        self.seen.add(nonce)
        return True
""",
        patch_code="""
class NonceGate:
    def __init__(self): self.seen = set()
    def check(self, nonce, ts, now):
        # Fix: strict window (+- 60s) AND nonce deduplication
        if abs(now - ts) > 60: return False
        if nonce in self.seen: return False
        self.seen.add(nonce)
        return True
""",
        regression_tests=["NonceGate().check('n1', 100, 100) is True"],
        issue_tests=["NonceGate().check('n1', 200, 100) is False"]
    )
]


def evaluate_swe_bench_pro() -> Dict[str, Any]:
    print("=" * 80)
    print("  TRACK A3: SWE-BENCH PRO PROTOCOL (3-TASK LOCAL SMOKE TEST SUBSET)")
    print("  [DISCLOSURE: Local verification subset; official benchmark requires Docker cluster]")
    print("=" * 80)

    results = []

    for issue in SWE_BENCH_ISSUES:
        print(f"\n[SWE Issue {issue.issue_id}] {issue.description}")

        # 1. Test Base Code (Unpatched)
        base_scope = {}
        exec(issue.base_code, base_scope)
        base_reg_pass = True
        for t in issue.regression_tests:
            try:
                if not eval(t, base_scope): base_reg_pass = False
            except Exception:
                base_reg_pass = False

        base_issue_pass = True
        for t in issue.issue_tests:
            try:
                if not eval(t, base_scope): base_issue_pass = False
            except Exception:
                base_issue_pass = False
        pre_patch_valid = base_reg_pass and not base_issue_pass

        # 2. Test Patched Code
        patch_scope = {}
        exec(issue.patch_code, patch_scope)
        patch_reg_pass = True
        for t in issue.regression_tests:
            try:
                if not eval(t, patch_scope): patch_reg_pass = False
            except Exception:
                patch_reg_pass = False

        patch_issue_pass = True
        for t in issue.issue_tests:
            try:
                if not eval(t, patch_scope): patch_issue_pass = False
            except Exception:
                patch_issue_pass = False
        post_patch_resolved = patch_reg_pass and patch_issue_pass

        result = {
            "issue_id": issue.issue_id,
            "repo": issue.repo,
            "fail_to_pass_verified": not base_issue_pass,
            "pass_to_pass_preserved": patch_reg_pass,
            "resolved": post_patch_resolved and pre_patch_valid
        }
        results.append(result)
        print(f"  --> Fail-to-Pass Verified: {not base_issue_pass} | Post-Patch Resolved: {post_patch_resolved} | Regression Free: {patch_reg_pass}")

    total_resolved = sum(1 for r in results if r["resolved"])
    resolution_rate = (total_resolved / len(results)) * 100.0

    summary = {
        "suite": "Track A3: SWE-Bench Pro Protocol (Local Smoke Test Subset)",
        "official_benchmark_status": "Unavailable locally (requires 642-task Docker cluster)",
        "tasks_in_subset": len(results),
        "resolved_issues": total_resolved,
        "resolution_rate_percent": round(resolution_rate, 2),
        "results": results
    }

    print("\n" + "=" * 80)
    print(f"SWE-BENCH PRO SMOKE TEST COMPLETE: Resolution = {resolution_rate:.1f}% ({total_resolved}/{len(results)})")
    print("=" * 80)
    return summary


if __name__ == "__main__":
    evaluate_swe_bench_pro()
