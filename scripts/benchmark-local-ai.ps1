# ==============================================================================
# InterviewOS Master Benchmark Suite Runner
# Measures Cryptographic integrity, Distributed recovery, Agent policy confusion matrix,
# Technical grading, Local speech WER/CER/RTF, and LLM tokens/sec & VRAM
# ==============================================================================

$root = (Get-Item $PSScriptRoot).Parent.FullName
$venvPython = Join-Path $root "venv\Scripts\python.exe"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  INTERVIEWOS MASTER BENCHMARKING SUITE" -ForegroundColor Cyan
Write-Host "  Platform: HP Victus Laptop | NVIDIA GeForce RTX 3050 (4GB VRAM)" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

# Set Python path to project root
$env:PYTHONPATH = $root

# Execute master benchmark orchestrator
& $venvPython -m benchmarks.run_all_benchmarks

Write-Host "`n======================================================================" -ForegroundColor Cyan
Write-Host "  ALL BENCHMARKS FINISHED. Report updated at docs/BENCHMARK_REPORT.md" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
