# Solo System (v11.1) — Render / Local deployment

## Local (Windows PowerShell)
1. Extract the ZIP and open PowerShell in the `backend` folder.
2. Double-click `run_local.ps1` or run:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```
3. Open `http://127.0.0.1:8000` on PC. On phone use `http://<PC_IP>:8000`.

## Deploy to Render
1. Create a new **Web Service** on Render and connect your repository.
2. In Render settings set:
   - **Environment**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
3. Ensure the repo has the whole `backend/` folder at root of the repo.

## Notes
- Service worker is served at `/sw.js` and static files under `/static/`.
- Manifest set to `display: standalone` for PWA install.
