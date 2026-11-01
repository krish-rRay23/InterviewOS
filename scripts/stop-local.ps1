# ==============================================================================
# InterviewOS Local Services Shutdown Script
# ==============================================================================

$root = (Get-Item $PSScriptRoot).Parent.FullName

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  STOPPING INTERVIEWOS LOCAL SERVICES" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

# Stop Local AI
$aiPidFile = Join-Path $root ".local_ai.pid"
if (Test-Path $aiPidFile) {
    $aiPid = Get-Content $aiPidFile
    Write-Host "Stopping Local AI Service (PID $aiPid)..." -ForegroundColor Yellow
    Stop-Process -Id $aiPid -Force -ErrorAction SilentlyContinue
    Remove-Item $aiPidFile -Force -ErrorAction SilentlyContinue
}

# Stop Backend
$backendPidFile = Join-Path $root ".backend.pid"
if (Test-Path $backendPidFile) {
    $backendPid = Get-Content $backendPidFile
    Write-Host "Stopping Backend Server (PID $backendPid)..." -ForegroundColor Yellow
    Stop-Process -Id $backendPid -Force -ErrorAction SilentlyContinue
    Remove-Item $backendPidFile -Force -ErrorAction SilentlyContinue
}

# Clean any lingering python or go server processes on ports 8000 / 8080
$ports = @(8000, 8080)
foreach ($p in $ports) {
    $conns = Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue
    if ($conns) {
        foreach ($c in $conns) {
            Write-Host "Releasing port $p (PID $($c.OwningProcess))..." -ForegroundColor Gray
            Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    }
}

Write-Host "`nAll InterviewOS local background services stopped successfully." -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Cyan
