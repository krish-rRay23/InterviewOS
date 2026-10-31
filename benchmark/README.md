# InterviewOS 4.0 Benchmark Laboratory

The `benchmark/` directory contains the complete industry-grade benchmark harness and evaluation catalog for InterviewOS 4.0.

## Benchmark Suites Overview

| Benchmark Suite | Directory | Purpose | Key Metric |
|---|---|---|---|
| **IOEB** | `benchmark/ioeb/` | Long-horizon engineering assignments (HackerRank-Bench paradigm) | Pass@1, Mean Score, C |
| **ASTRA** | `benchmark/astra/` | Model Consistency Evaluator (32 repeated trials) | $C = 1 - \frac{\sigma}{\mu}$ |
| **SWE-Bench Pro** | `benchmark/swe_bench_pro/` | Issue resolution, fail-to-pass & regression tests | Resolution Rate (%) |
| **Terminal-Bench** | `benchmark/terminal_bench/` | Tool-using agent terminal operations | Score (%) |
| **LiveCodeBench** | `benchmark/livecodebench/` | Polyglot C++20 and Python code generation & repair | Score (%) |
| **Candidate Assessment** | `benchmark/candidate_assessment/`| Candidate skills evaluation (decoupled from proctoring) | Candidate Average (%) |
| **Integrity Benchmark** | `benchmark/integrity_benchmark/`| Multi-modal proctoring vs JPlag/MOSS on 100+ ground truth cases | FPR, Precision, Brier |

## Running the Benchmarks

To execute the entire 7-suite benchmark suite:

```bash
python -m benchmark.master_runner
```

To run individual suites:
```bash
python -m benchmark.ioeb.harness
python -m benchmark.astra.evaluator
python -m benchmark.swe_bench_pro.evaluator
python -m benchmark.terminal_bench.evaluator
python -m benchmark.livecodebench.evaluator
python -m benchmark.candidate_assessment.evaluator
python -m benchmark.integrity_benchmark.evaluator
```

Generated reports are located in `benchmark/reports/`:
- `index.html` (Interactive multi-tab executive dashboard)
- `summary.json` (Structured JSON benchmark output)
- `task_results.csv` (Task-by-task execution statistics)
- `failure_analysis.md` (Detailed failure and calibration analysis)
