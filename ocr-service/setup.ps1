# One-time setup for the PaddleOCR license-plate service.
#   powershell -ExecutionPolicy Bypass -File setup.ps1 [-PaddleRepo <path>]
param(
    # Path to the existing local PaddleOCR source folder (the model/code you already have).
    [string]$PaddleRepo = "d:\FPT_ThNgwx\PaddleOCR-main\PaddleOCR-main"
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# 1) Find Python 3.10–3.12 (Paddle wheels don't cover 3.13 yet)
$python = $null
foreach ($cand in @("py -3.12", "py -3.11", "py -3.10", "python")) {
    try {
        $v = Invoke-Expression "$cand --version" 2>$null
        if ($v -match "Python 3\.(10|11|12)") { $python = $cand; break }
    } catch {}
}
if (-not $python) {
    Write-Host "Không tìm thấy Python 3.10–3.12. Cài bằng:  winget install -e --id Python.Python.3.11" -ForegroundColor Red
    exit 1
}
Write-Host "Dùng $python ($(Invoke-Expression "$python --version"))"

# 2) Virtual env
if (-not (Test-Path ".venv")) { Invoke-Expression "$python -m venv .venv" }
$pip = ".\.venv\Scripts\python.exe -m pip"

Invoke-Expression "$pip install --upgrade pip"
Invoke-Expression "$pip install -r requirements.txt"

# 3) Install PaddleOCR from the local repo. The folder is a ZIP extract (no .git),
#    and the repo derives its version from git — so pretend a version for the build.
$env:SETUPTOOLS_SCM_PRETEND_VERSION = "3.3.0"
if (Test-Path $PaddleRepo) {
    Write-Host "Cài PaddleOCR từ thư mục local: $PaddleRepo"
    & .\.venv\Scripts\python.exe -m pip install $PaddleRepo
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Cài từ thư mục local thất bại — dùng bản PyPI thay thế." -ForegroundColor Yellow
        & .\.venv\Scripts\python.exe -m pip install "paddleocr>=3.0,<4"
    }
} else {
    Write-Host "Không thấy $PaddleRepo — cài paddleocr từ PyPI." -ForegroundColor Yellow
    & .\.venv\Scripts\python.exe -m pip install "paddleocr>=3.0,<4"
}

Write-Host ""
Write-Host "Xong. Chạy service bằng:  powershell -ExecutionPolicy Bypass -File start.ps1" -ForegroundColor Green
