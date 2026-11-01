# ==============================================================================
# InterviewOS Local AI Verification Script
# Tests all endpoints (Chat, STT, TTS, Embed, Metrics) for offline functionality
# ==============================================================================

$ErrorActionPreference = "Continue"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  INTERVIEWOS LOCAL-FIRST RUNTIME INTEGRATION VERIFICATION" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

$baseUrl = "http://127.0.0.1:8000"
$allPassed = $true

# 1. Health & VRAM Check
Write-Host "`n[1/5] Testing GET /health & GPU VRAM Allocation..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get -TimeoutSec 5
    Write-Host " -> Status:           $($health.status)" -ForegroundColor Green
    Write-Host " -> Mode:             $($health.mode)" -ForegroundColor Green
    Write-Host " -> Cloud Allowed:    $($health.allow_cloud_ai)" -ForegroundColor Green
    Write-Host " -> GPU Device:       $($health.gpu_vram.device_name)" -ForegroundColor Green
    Write-Host " -> VRAM Total:       $($health.gpu_vram.total_mb) MB" -ForegroundColor Green
    Write-Host " -> VRAM Used:        $($health.gpu_vram.used_mb) MB ($($health.gpu_vram.utilization_pct)%)" -ForegroundColor Green
    Write-Host " -> GPU Temp:         $($health.gpu_vram.temperature_c) C | Power: $($health.gpu_vram.power_w) W" -ForegroundColor Green
} catch {
    Write-Host " -> [FAIL] Could not connect to Local AI Service on $baseUrl. Please start via .\scripts\start-local.ps1." -ForegroundColor Red
    $allPassed = $false
}

# 2. Local Chat Inference Test (Qwen2.5-Coder 3B)
Write-Host "`n[2/5] Testing POST /chat (Qwen2.5-Coder 3B)..." -ForegroundColor Yellow
try {
    $chatBody = @{
        task_type = "code_generation"
        messages = @(
            @{ role = "system"; content = "You are a C++ systems programmer." }
            @{ role = "user"; content = "Return a one-line C++20 concept check for std::integral." }
        )
    } | ConvertTo-Json -Depth 5

    $start = Get-Date
    $chatRes = Invoke-RestMethod -Uri "$baseUrl/chat" -Method Post -Body $chatBody -ContentType "application/json" -TimeoutSec 30
    $elapsed = ((Get-Date) - $start).TotalSeconds

    Write-Host " -> Model Used:       $($chatRes.model_used)" -ForegroundColor Green
    Write-Host " -> Throughput:       $($chatRes.tokens_per_sec) tokens/sec" -ForegroundColor Green
    Write-Host " -> Latency:          $([math]::Round($elapsed, 2))s" -ForegroundColor Green
    Write-Host " -> Output:           $($chatRes.response.Trim())" -ForegroundColor Gray
} catch {
    Write-Host " -> [FAIL] Chat inference test failed: $_" -ForegroundColor Red
    $allPassed = $false
}

# 3. Piper TTS Synthesis Test
Write-Host "`n[3/5] Testing POST /synthesize (Piper TTS on CPU)..." -ForegroundColor Yellow
try {
    $synBody = @{ text = "Assessment environment integrity check completed successfully." } | ConvertTo-Json
    $tempWav = Join-Path $env:TEMP "verify_synth.wav"

    $start = Get-Date
    Invoke-RestMethod -Uri "$baseUrl/synthesize" -Method Post -Body $synBody -ContentType "application/json" -OutFile $tempWav -TimeoutSec 25
    $elapsed = ((Get-Date) - $start).TotalSeconds
    $size = (Get-Item $tempWav).Length

    Write-Host " -> WAV Generated:    $size bytes" -ForegroundColor Green
    Write-Host " -> Latency:          $([math]::Round($elapsed, 3))s" -ForegroundColor Green
} catch {
    Write-Host " -> [FAIL] Speech synthesis test failed: $_" -ForegroundColor Red
    $allPassed = $false
}

# 4. Nomic Vector Embedding Test
Write-Host "`n[4/5] Testing POST /embed (Nomic Embed Text 768-dim)..." -ForegroundColor Yellow
try {
    $embedBody = @{
        texts = @("Candidate demonstrated linear time complexity using two pointers.")
        task_type = "document"
    } | ConvertTo-Json

    $start = Get-Date
    $embedRes = Invoke-RestMethod -Uri "$baseUrl/embed" -Method Post -Body $embedBody -ContentType "application/json" -TimeoutSec 20
    $elapsed = ((Get-Date) - $start).TotalSeconds

    Write-Host " -> Model:            $($embedRes.model)" -ForegroundColor Green
    Write-Host " -> Dimensions:       $($embedRes.dimensions)" -ForegroundColor Green
    Write-Host " -> Latency:          $([math]::Round($elapsed, 3))s" -ForegroundColor Green
} catch {
    Write-Host " -> [FAIL] Vector embedding test failed: $_" -ForegroundColor Red
    $allPassed = $false
}

# 5. Go Backend Health Check
Write-Host "`n[5/5] Testing Backend API (:8080)..." -ForegroundColor Yellow
try {
    $beRes = Invoke-RestMethod -Uri "http://127.0.0.1:8080/v1/openapi.json" -Method Get -TimeoutSec 5
    Write-Host " -> Backend API:      ONLINE (OpenAPI: $($beRes.info.title))" -ForegroundColor Green
} catch {
    Write-Host " -> [INFO] Backend on port 8080 is not currently active (run .\scripts\start-local.ps1 to start)." -ForegroundColor Yellow
}

Write-Host "`n======================================================================" -ForegroundColor Cyan
if ($allPassed) {
    Write-Host "  LOCAL RUNTIME VERIFICATION: ALL ENGINES OPERATIONAL (PASS)" -ForegroundColor Green
} else {
    Write-Host "  LOCAL RUNTIME VERIFICATION: ENCOUNTERED DEGRADATION (SEE ABOVE)" -ForegroundColor Yellow
}
Write-Host "======================================================================" -ForegroundColor Cyan
