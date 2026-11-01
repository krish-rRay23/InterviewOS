# Forensic Benchmark Audit: Investigation of 100% Results

**Audit Timestamp**: 2026-11-01  
**Auditor**: Principal Systems Architect & AI Evaluation Researcher  
**Historical Commit Audited**: `347b877` (InterviewOS 4.0 Release)  
**Historical Archive Path**: `benchmark/reports/archive_4.0/`

---

## 1. Executive Summary: Why the 100% Claims Were Invalid

An exhaustive audit of the benchmark implementations in `benchmark/` revealed that previously published **100% success metrics were the artifact of simplified test fixtures, self-grading loops, non-standard metric definitions, and small-N smoke tests**. 

There was no intentional falsification of code, but the evaluation methodology suffered from critical research design errors:
1. **Conflation of Smoke Tests with Official Benchmarks**: 3-issue and 4-issue unit tests were labelled as "SWE-Bench Pro V2 (100%)" and "Terminal-Bench (100%)".
2. **Circular Self-Grading in Integrity Benchmarking**: Synthetic scenarios were constructed using the exact same rule signatures as the `BehavioralInvestigatorAgent` and evaluated on an $N=100$ dataset. An FPR of 0% on 40 clean cases is statistically incapable of proving a zero population error rate.
3. **Invalid ASTRA Metric Formulation**: Consistency was computed as $C = 1 - \frac{\sigma}{\mu}$ on identical deterministic re-runs of a single Python function, resulting in $\sigma=0$ and an artificial $C=1.0000$.
4. **Leakage & Hardcoded Expectation Corrections**: In LiveCodeBench, a bitwise test output prediction failed (`predicted 69 != 95`), and was promptly edited to match the function output, turning a failure into a pass without addressing the underlying prediction agent.
5. **Decoupling of Live Agent Runtime from Benchmark Harnesses**: The IOEB tasks executed hardcoded reference strings rather than sending prompts to an autonomous AI agent attempting to generate or repair the solution.

---

## 2. Detailed Technical Audit by Benchmark Suite

### A. IOEB (InterviewOS Engineering Benchmark)
- **Previous Claim**: 100% Pass@1, Mean Score 100.0%, Consistency 1.0000 across 8 tasks.
- **Root Cause of 100% Result**: The test runner executed `task.reference_code` directly (`run_code_tests(task, task.reference_code)`). The reference code was written by the same author who wrote the verifiers. The benchmark tested whether the author's reference solution matched the author's unit test, not an autonomous agent's engineering problem-solving capabilities.
- **Audit Finding**: **Invalid as an AI Agent Benchmark**. Valid only as a **Verifier Integrity Smoke Test**. Must be relabelled as Track A1 Verifier Validation Suite.

### B. ASTRA Model Consistency Evaluator
- **Previous Claim**: Consistency Index $C = 1.0000$ across 32 repeated trials.
- **Root Cause of 100% Result**: 
  1. It executed the static reference implementation repeatedly without thermal variation or LLM inference.
  2. The formula used ($C = 1 - \frac{\sigma}{\mu}$) is a custom heuristic, not the published HackerRank ASTRA methodology (which tracks task-level standard deviation, Pass@1 vs Pass@K, and stability across 32 distinct generative runs).
- **Audit Finding**: **Withdrawn as an ASTRA result**. Must be replaced with Track A2: ASTRA-Inspired Consistency Evaluation measuring generative variance and Pass@1.

### C. SWE-Bench Pro V2 Protocol
- **Previous Claim**: Resolution Rate = 100.0% (3/3).
- **Root Cause of 100% Result**: The official SWE-Bench Pro V2 public release contains **642 tasks across 11 repositories** with strict Docker sandboxing. The evaluator contained exactly 3 hardcoded micro-snippets in a local Python list. Labelling a 3-test smoke script as "SWE-Bench Pro V2 100%" was severely misleading.
- **Audit Finding**: **Withdrawn as SWE-Bench Pro V2**. Must be relabelled as **Custom Regression & Patch Verification Smoke Test (3 Tasks)**. The official benchmark must be declared partially reproduced or unavailable in local non-Docker host runtimes.

### D. Terminal-Bench
- **Previous Claim**: Score = 100.0% (4/4).
- **Root Cause of 100% Result**: The official Harbor Terminal-Bench suite tests agents in real terminal environments across complex multi-step workflows. The repository contained 4 simple regex and JSON parsing unit tests in Python.
- **Audit Finding**: **Withdrawn as official Terminal-Bench**. Relabelled as **Tool Execution & Forensic Command Smoke Test (4 Tasks)**.

### E. LiveCodeBench
- **Previous Claim**: Score = 100.0% (4/4).
- **Root Cause of 100% Result**: Evaluated 4 handcrafted scripts. When `[LCB-ALL-04]` failed with output 69, the test expectation was patched to 69 in the source file. No autonomous agent was evaluated.
- **Audit Finding**: **Withdrawn as official LiveCodeBench**. Relabelled as **Polyglot Execution & Compilation Smoke Test**.

### F. Candidate Assessment Benchmark
- **Previous Claim**: Mean Candidate Score = 90.00%.
- **Root Cause**: Evaluated 3 static algorithms (Two Sum, Merge Intervals, Longest Valid Parentheses).
- **Audit Finding**: Partially valid as a demonstration of weighted partial scoring and hidden test execution, but lacked statistical depth and candidate population diversity.

### G. Assessment Integrity Benchmark
- **Previous Claim**: Precision 100.0%, Recall 100.0%, FPR 0.00%, False Accusations 0.0 / 1000, ROC-AUC 1.0000.
- **Root Cause of 100% Result**: 
  1. Synthetic data generator constructed event payloads using the exact same property names and values (`classification: RESTRICTED`, `display_count: 1`) that the `BehavioralInvestigatorAgent` looked for.
  2. Sample size $N=100$ contained only 40 clean cases. In statistical testing, observing 0 false positives in 40 trials yields a 95% upper confidence bound of:
     $$\text{Upper } 95\% \text{ CI} \approx 1 - (1 - 0.95)^{1/40} \approx 7.21\%$$
     Claiming an FPR of $0.00\%$ or $0.0 / 1000$ based on 40 samples is mathematically unsound. To claim an upper bound of $0.1\%$ requires at least 3,000 independent clean sessions under the Rule of Three ($\frac{3}{N}$).
- **Audit Finding**: **Withdrawn as empirical field integrity proof**. Must be relabelled as **Deterministic Rule Validation Suite**. A genuine benchmark must report exact sample sizes, 95% Clopper-Pearson confidence bounds, and acknowledge statistical limits.

---

## 3. Dispositions and Remediation Matrix

| Suite | Previous Claim | Audit Finding | Corrected Classification |
|---|---|---|---|
| **IOEB** | 100% Pass@1 | Author reference tested against author verifier | Track A1: IOEB Reference & Verifier Audit (Smoke Test) |
| **ASTRA** | C = 1.0000 | Custom heuristic on static code | Track A2: ASTRA-Inspired Consistency Evaluation (Disclosed) |
| **SWE-Bench Pro** | 100% (3/3) | 3-item script masquerading as 642-task benchmark | Track A3: Patch & Regression Smoke Test (Official: Unavailable) |
| **Terminal-Bench**| 100% (4/4) | 4 regex functions, not Harbor framework | Track A4: Terminal Operations Smoke Test (Official: Unavailable) |
| **LiveCodeBench** | 100% (4/4) | 4 local problems with patched expectation | Track A5: Multi-Language Execution Test (Official: Unavailable) |
| **Candidate Assess**| 90.0% Mean | 3 hardcoded problems | Track B: Candidate Assessment Evaluation Harness |
| **Integrity Bench**| FPR 0.00%, F1 1.000 | Circular rule validation, $N=100$ sample | Track C: Assessment Integrity Benchmark with 95% Confidence Bounds |
