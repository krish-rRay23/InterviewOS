# ==============================================================================
# InterviewOS Local Services Startup Script
# Starts Local AI Service (FastAPI :8000) and Backend Server (Go :8080)
# ==============================================================================

$ErrorActionPreference = "Continue"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  STARTING INTERVIEWOS LOCAL-FIRST AI RUNTIME & SERVICES" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

$root = (Get-Item $PSScriptRoot).Parent.FullName
$venvPython = Join-Path $root "venv\Scripts\python.exe"

# 1. Check Ollama Daemon
Write-Host "`n[1/4] Checking Ollama Local Inference Daemon..." -ForegroundColor Yellow
$ollamaRunning = $false
try {
    $res = Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags" -Method Get -TimeoutSec 2
    $ollamaRunning = $true
    Write-Host " -> Ollama is running on http://127.0.0.1:11434" -ForegroundColor Green
} catch {
    Write-Host " -> Starting Ollama in background..." -ForegroundColor Cyan
    Start-Process "ollama" -ArgumentList "serve" -WindowStyle Hidden
    Start-Sleep -Seconds 2
}

# Clean any lingering processes on ports 8000 and 8080 before starting
foreach ($p in @(8000, 8080)) {
    $conns = Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue
    if ($conns) {
        foreach ($c in $conns) {
            Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    }
}

# 2. Start Local AI FastAPI Service (:8000)
Write-Host "`n[2/4] Starting InterviewOS Local AI Service (:8000)..." -ForegroundColor Yellow
$aiPidFile = Join-Path $root ".local_ai.pid"
if (Test-Path $aiPidFile) {
    $oldPid = Get-Content $aiPidFile
    $proc = Get-Process -Id $oldPid -ErrorAction SilentlyContinue
    if ($proc) {
        Write-Host " -> Stopping existing Local AI process (PID $oldPid)..." -ForegroundColor Gray
        Stop-Process -Id $oldPid -Force -ErrorAction SilentlyContinue
    }
    Remove-Item $aiPidFile -Force -ErrorAction SilentlyContinue
}

$aiLogFile = Join-Path $root "local_ai.log"
$aiProc = Start-Process -FilePath $venvPython `
    -ArgumentList "-m", "uvicorn", "local_ai.main:app", "--host", "127.0.0.1", "--port", "8000" `
    -WorkingDirectory $root `
    -RedirectStandardOutput $aiLogFile `
    -RedirectStandardError (Join-Path $root "local_ai.err.log") `
    -WindowStyle Hidden `
    -PassThru

Set-Content -Path $aiPidFile -Value $aiProc.Id
Write-Host " -> Local AI Service launched (PID: $($aiProc.Id)). Logs: $aiLogFile" -ForegroundColor Green

# 3. Start Go Backend Server (:8080)
Write-Host "`n[3/4] Starting InterviewOS Go Backend Server (:8080)..." -ForegroundColor Yellow
$backendPidFile = Join-Path $root ".backend.pid"
if (Test-Path $backendPidFile) {
    $oldPid = Get-Content $backendPidFile
    $proc = Get-Process -Id $oldPid -ErrorAction SilentlyContinue
    if ($proc) {
        Write-Host " -> Stopping existing Backend process (PID $oldPid)..." -ForegroundColor Gray
        Stop-Process -Id $oldPid -Force -ErrorAction SilentlyContinue
    }
    Remove-Item $backendPidFile -Force -ErrorAction SilentlyContinue
}

# Ensure binary is compiled for instantaneous and robust daemon execution
$backendBinary = Join-Path $root "backend\server.exe"
if (-not (Test-Path $backendBinary)) {
    Write-Host " -> Compiling Go backend binary (server.exe)..." -ForegroundColor Gray
    Start-Process -FilePath "go" -ArgumentList "build", "-o", "server.exe", "./cmd/server" -WorkingDirectory (Join-Path $root "backend") -Wait -NoNewWindow
}

$backendLogFile = Join-Path $root "backend.log"
$backendProc = Start-Process -FilePath $backendBinary `
    -WorkingDirectory (Join-Path $root "backend") `
    -RedirectStandardOutput $backendLogFile `
    -RedirectStandardError (Join-Path $root "backend.err.log") `
    -WindowStyle Hidden `
    -PassThru

Set-Content -Path $backendPidFile -Value $backendProc.Id
Write-Host " -> Backend Server launched (PID: $($backendProc.Id)). Logs: $backendLogFile" -ForegroundColor Green

# 4. Await Health Check
Write-Host "`n[4/4] Verifying Service Readiness..." -ForegroundColor Yellow
$maxRetries = 12
$aiReady = $false
$backendReady = $false

for ($i = 0; $i -lt $maxRetries; $i++) {
    Start-Sleep -Seconds 1
    if (-not $backendReady) {
        try {
            $bkHealth = Invoke-RestMethod -Uri "http://127.0.0.1:8080/v1/health" -Method Get -TimeoutSec 1
            if ($bkHealth.status -eq "healthy") {
                $backendReady = $true
            }
        } catch {}
    }
    if (-not $aiReady) {
        try {
            $health = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -Method Get -TimeoutSec 1
            if ($health.status -eq "healthy" -or $health.status -eq "degraded") {
                $aiReady = $true
            }
        } catch {}
    }
    if ($backendReady -and $aiReady) {
        break
    }
}

if ($backendReady) {
    Write-Host " -> [OK] Go Backend Server responded on http://127.0.0.1:8080/v1/health" -ForegroundColor Green
} else {
    Write-Host " -> [WAITING] Go Backend Server is starting. Check: backend.log" -ForegroundColor Yellow
}

if ($aiReady) {
    Write-Host " -> [OK] Local AI Service responded on http://127.0.0.1:8000/health" -ForegroundColor Green
} else {
    Write-Host " -> [WAITING] Local AI Service is initializing models. Check: local_ai.log" -ForegroundColor Yellow
}

Write-Host "`n======================================================================" -ForegroundColor Cyan
Write-Host "  INTERVIEWOS LOCAL SERVICES ARE ACTIVE" -ForegroundColor Cyan
Write-Host "  Local AI Service:  http://127.0.0.1:8000 (Docs: http://127.0.0.1:8000/docs)" -ForegroundColor White
Write-Host "  Backend REST API:  http://127.0.0.1:8080" -ForegroundColor White
Write-Host "  Ollama Local LLM:  http://127.0.0.1:11434" -ForegroundColor White
Write-Host "  To stop all:       .\scripts\stop-local.ps1" -ForegroundColor Gray
Write-Host "  To verify health:  .\scripts\verify-local.ps1" -ForegroundColor Gray
Write-Host "======================================================================" -ForegroundColor Cyan
