# ==============================================================================
# InterviewOS Local AI Benchmark Suite Runner
# Measures LLM tokens/sec, VRAM utilization, STT/TTS latency & RTF
# ==============================================================================

$root = (Get-Item $PSScriptRoot).Parent.FullName
$venvPython = Join-Path $root "venv\Scripts\python.exe"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  INTERVIEWOS LOCAL AI BENCHMARKING SUITE" -ForegroundColor Cyan
Write-Host "  Platform: HP Victus Laptop | NVIDIA GeForce RTX 3050 (4GB VRAM)" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

# 1. Run LLM Benchmarks
Write-Host "`n>>> [Suite 1/2] Local LLMs & Dense Vector Embeddings..." -ForegroundColor Yellow
& $venvPython -m local_ai.evaluation.model_benchmark

# 2. Run Speech Benchmarks
Write-Host "`n>>> [Suite 2/2] Local Speech Recognition & Synthesis Stack..." -ForegroundColor Yellow
& $venvPython -m local_ai.evaluation.speech_benchmark

Write-Host "`n======================================================================" -ForegroundColor Cyan
Write-Host "  ALL BENCHMARKS FINISHED" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
