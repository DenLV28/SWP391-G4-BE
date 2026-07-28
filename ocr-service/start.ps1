# Starts the PaddleOCR license-plate service on http://localhost:8868
#   powershell -ExecutionPolicy Bypass -File start.ps1
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path ".venv")) {
    Write-Host "Chưa setup — chạy setup.ps1 trước." -ForegroundColor Red
    exit 1
}
& .\.venv\Scripts\python.exe -m uvicorn app:app --host 0.0.0.0 --port 8868
