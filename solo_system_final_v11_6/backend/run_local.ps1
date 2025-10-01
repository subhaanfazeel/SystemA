
$ErrorActionPreference = "Stop"
if (-not (Test-Path .venv)) { python -m venv .venv }
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned -Force
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
