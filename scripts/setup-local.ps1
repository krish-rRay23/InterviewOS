# ==============================================================================
# InterviewOS Local AI Runtime Setup Script
# Targets: HP Victus Laptop (NVIDIA RTX 3050 4GB VRAM, Windows 11)
# ==============================================================================

$ErrorActionPreference = "Stop"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  INTERVIEWOS LOCAL-FIRST AI SETUP & ENVIRONMENT CONFIGURATION" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

# 1. Hardware & Environment Inspection
Write-Host "`n[1/6] Inspecting Local Hardware & Runtimes..." -ForegroundColor Yellow
if (Get-Command "nvidia-smi" -ErrorAction SilentlyContinue) {
    $gpuName = (& nvidia-smi --query-gpu=name --format=csv,noheader).Trim()
    $vram = (& nvidia-smi --query-gpu=memory.total --format=csv,noheader).Trim()
    Write-Host " -> GPU Detected: $gpuName ($vram)" -ForegroundColor Green
} else {
    Write-Host " -> Warning: nvidia-smi not found in PATH. GPU telemetry will use software emulation." -ForegroundColor Yellow
}

# 2. Python 3.11 Virtual Environment Check
Write-Host "`n[2/6] Verifying Python 3.11 Virtual Environment..." -ForegroundColor Yellow
$venvPython = Join-Path $PSScriptRoot "..\venv\Scripts\python.exe"

if (-not (Test-Path $venvPython)) {
    Write-Host " -> Creating virtual environment at .\venv using Python 3.11..." -ForegroundColor Cyan
    if (Get-Command "py" -ErrorAction SilentlyContinue) {
        & py -3.11 -m venv (Join-Path $PSScriptRoot "..\venv")
    } else {
        & python -m venv (Join-Path $PSScriptRoot "..\venv")
    }
}

$pyVer = (& $venvPython -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}')")
Write-Host " -> Virtual Environment Python: $pyVer ($venvPython)" -ForegroundColor Green

# 3. Pip Dependencies Installation
Write-Host "`n[3/6] Installing Local AI & Audio Stack Dependencies..." -ForegroundColor Yellow
& $venvPython -m pip install --upgrade pip --quiet
& $venvPython -m pip install fastapi "uvicorn[standard]" pydantic requests httpx python-multipart soundfile numpy psutil pynvml faster-whisper piper-tts --quiet
Write-Host " -> Core dependencies installed: FastAPI, Uvicorn, Faster-Whisper, Piper-TTS." -ForegroundColor Green

# 4. Piper Voice Assets
Write-Host "`n[4/6] Verifying Piper Speech Synthesis Models..." -ForegroundColor Yellow
$piperDir = Join-Path $PSScriptRoot "..\local_ai\models\piper"
if (-not (Test-Path $piperDir)) {
    New-Item -ItemType Directory -Path $piperDir -Force | Out-Null
}

$onnxFile = Join-Path $piperDir "en_US-lessac-medium.onnx"
$jsonFile = Join-Path $piperDir "en_US-lessac-medium.onnx.json"

if (-not (Test-Path $onnxFile) -or -not (Test-Path $jsonFile)) {
    Write-Host " -> Downloading Piper en_US-lessac-medium model..." -ForegroundColor Cyan
    & $venvPython -c "
import os, urllib.request
piper_dir = r'$piperDir'
onnx_url = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx'
json_url = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json'
onnx_path = os.path.join(piper_dir, 'en_US-lessac-medium.onnx')
json_path = os.path.join(piper_dir, 'en_US-lessac-medium.onnx.json')
if not os.path.exists(json_path):
    urllib.request.urlretrieve(json_url, json_path)
if not os.path.exists(onnx_path):
    urllib.request.urlretrieve(onnx_url, onnx_path)
"
}
Write-Host " -> Piper voice assets verified in: $piperDir" -ForegroundColor Green

# 5. Ollama Daemon & Model Verification
Write-Host "`n[5/6] Verifying Ollama Daemon & Installed Models..." -ForegroundColor Yellow
try {
    $ollamaTags = Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags" -Method Get -TimeoutSec 3
    $installed = $ollamaTags.models | ForEach-Object { $_.name }
    Write-Host " -> Ollama Daemon is ONLINE at http://127.0.0.1:11434" -ForegroundColor Green

    $requiredModels = @("qwen2.5-coder:3b", "qwen2.5-coder:1.5b", "granite4.1:3b", "nomic-embed-text:latest")
    foreach ($m in $requiredModels) {
        $found = $installed | Where-Object { $_ -like "*$m*" }
        if ($found) {
            Write-Host "    [OK] Model available: $m" -ForegroundColor Green
        } else {
            Write-Host "    [WARNING] Model missing: $m (Please run: ollama pull $m)" -ForegroundColor Red
        }
    }
} catch {
    Write-Host " -> Ollama daemon not reachable at http://127.0.0.1:11434. Please start Ollama." -ForegroundColor Yellow
}

# 6. Environment Configuration File (.env)
Write-Host "`n[6/6] Writing .env Configuration (Enforcing Offline-First)..." -ForegroundColor Yellow
$envContent = @"
# InterviewOS Local-First Configuration
OFFLINE_MODE=true
ALLOW_CLOUD_AI=false

# Local AI Service
LOCAL_AI_HOST=127.0.0.1
LOCAL_AI_PORT=8000
OLLAMA_BASE_URL=http://127.0.0.1:11434

# RTX 3050 4GB VRAM Optimization
OLLAMA_MAX_LOADED_MODELS=1
OLLAMA_NUM_PARALLEL=1
DEFAULT_NUM_CTX=2048

# Speech Engines (CPU INT8 / ONNX)
WHISPER_DEVICE=cpu
WHISPER_COMPUTE_TYPE=int8
PIPER_DEFAULT_VOICE=en_US-lessac-medium
"@
$envPath = Join-Path $PSScriptRoot "..\.env"
Set-Content -Path $envPath -Value $envContent -Encoding UTF8
Write-Host " -> .env configured at $envPath" -ForegroundColor Green

Write-Host "`n======================================================================" -ForegroundColor Cyan
Write-Host "  SETUP COMPLETE: INTERVIEWOS LOCAL RUNTIME IS READY TO LAUNCH" -ForegroundColor Cyan
Write-Host "  Use: .\scripts\start-local.ps1 to start all local services." -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
