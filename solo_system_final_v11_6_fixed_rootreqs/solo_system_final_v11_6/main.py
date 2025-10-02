# main.py - Solo System backend (Supabase-ready, local fallback)
# Copy/paste this file to replace your existing main.py

import os
import json
import random
import logging
from datetime import datetime, date
from typing import Optional, Any, Dict

import requests
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("solo")

# === Paths & Static ===
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

POSSIBLE_STATIC = [
    os.path.join(BASE_DIR, "static"),
    os.path.join(BASE_DIR, "..", "static"),
    os.path.join(BASE_DIR, "..", "frontend", "static"),
    os.path.join(BASE_DIR, "..", "frontend"),
]
STATIC_DIR: Optional[str] = None
for p in POSSIBLE_STATIC:
    if os.path.exists(p):
        STATIC_DIR = os.path.normpath(p)
        break
if not STATIC_DIR:
    STATIC_DIR = os.path.join(BASE_DIR, "static")

# Ensure data dir exists for local fallback
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)
DATA_FILE = os.path.join(DATA_DIR, "player_data.json")

# === Supabase config (optional) ===
# Must be set as environment variables (Render Dashboard or local shell)
# SUPABASE_URL = "https://<project>.supabase.co"
# SUPABASE_KEY = "<service_role_or_rest_key>"
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

def supabase_headers() -> Dict[str, str]:
    if not SUPABASE_KEY:
        return {}
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }

def supabase_base_rest() -> str:
    return SUPABASE_URL.rstrip("/") + "/rest/v1"

# === Small helpers ===
def now_iso() -> str:
    return datetime.now().isoformat()

def seed_data() -> Dict[str, Any]:
    return {
        "name": None,
        "tasks": [],
        "punishments": ["10m cold shower", "50 burpees", "No social media today"],
        "non_negotiables": [
            {"text": "No phone in bed", "created": now_iso(), "modified": None},
            {"text": "No junk after 8pm", "created": now_iso(), "modified": None},
        ],
        "streak": 0,
        "best_streak": 0,
        "last_login": None,
        "shop": {
            "coins": 0,
            "items": [],
            "catalog": [
                {"id": 1, "name": "Skip Punishment", "price": 50, "effect": "skip_punishment", "value": 1},
                {"id": 2, "name": "Cheat Meal", "price": 20, "effect": "cheat_meal", "value": 1},
                {"id": 3, "name": "Extra Time", "price": 30, "effect": "extra_time", "value": 60},
                {"id": 4, "name": "XP Boost", "price": 40, "effect": "xp_boost", "value": 1},
            ],
        },
        "ongoing_punishments": [],
        "stat_progress": {
            "strength": {"level": 1, "xp": 0},
            "intelligence": {"level": 1, "xp": 0},
            "spirituality": {"level": 1, "xp": 0},
            "discipline": {"level": 1, "xp": 0},
        },
        "attributes": {"strength": 0, "intelligence": 0, "spirituality": 0, "discipline": 0},
        "diary": [],
        "settings": {"sounds": True, "mobile_fullscreen": True},
        "stats": {"tasks_completed": 0},
    }

# === Supabase helpers (REST) ===
def _supabase_filter_id_singleton() -> str:
    # PostgREST filtering; id is text 'singleton'
    return "id=eq.'singleton'"

def get_from_supabase() -> Optional[Dict[str, Any]]:
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
    try:
        url = f"{supabase_base_rest()}/player_data?select=data&{_supabase_filter_id_singleton()}"
        resp = requests.get(url, headers=supabase_headers(), timeout=8)
        if resp.status_code == 200:
            arr = resp.json()
            if isinstance(arr, list) and len(arr) > 0:
                return arr[0].get("data") or seed_data()
            # row missing -> create
            payload = {"id": "singleton", "data": seed_data()}
            create_url = f"{supabase_base_rest()}/player_data"
            r = requests.post(create_url, headers={**supabase_headers(), "Prefer": "return=representation"}, json=payload, timeout=8)
            if r.status_code in (201, 200):
                try:
                    created = r.json()
                    if isinstance(created, list) and len(created) > 0:
                        return created[0].get("data") or payload["data"]
                except Exception:
                    pass
                return payload["data"]
            log.warning("Supabase create returned %s: %s", r.status_code, r.text)
            return seed_data()
        else:
            log.error("Supabase GET failed %s: %s", resp.status_code, resp.text)
            return None
    except Exception as e:
        log.exception("Supabase GET exception: %s", e)
        return None

def save_to_supabase(data: Dict[str, Any]) -> bool:
    if not SUPABASE_URL or not SUPABASE_KEY:
        return False
    try:
        url = f"{supabase_base_rest()}/player_data?{_supabase_filter_id_singleton()}"
        payload = {"data": data}
        resp = requests.patch(url, headers={**supabase_headers(), "Prefer": "return=representation"}, json=payload, timeout=8)
        if resp.status_code in (200, 204):
            return True
        # Attempt to insert if patch failed
        create_url = f"{supabase_base_rest()}/player_data"
        payload2 = {"id": "singleton", "data": data}
        r2 = requests.post(create_url, headers={**supabase_headers(), "Prefer": "return=representation"}, json=payload2, timeout=8)
        if r2.status_code in (201, 200):
            return True
        log.error("Supabase save failed %s: %s", r2.status_code, (r2.text if 'r2' in locals() else resp.text))
        return False
    except Exception as e:
        log.exception("Supabase save exception: %s", e)
        return False

# === Local file helpers ===
def load_local_file() -> Dict[str, Any]:
    if not os.path.exists(DATA_FILE):
        d = seed_data()
        save_local_file(d)
        return d
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        log.exception("Error reading local data file. Re-seeding.")
        d = seed_data()
        save_local_file(d)
        return d

def save_local_file(data: Dict[str, Any]) -> bool:
    try:
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False, default=str)
        return True
    except Exception as e:
        log.exception("Failed to save local data: %s", e)
        return False

# Unified load/save that prefer Supabase if configured
def load_data() -> Dict[str, Any]:
    # try Supabase first (if configured)
    if SUPABASE_URL and SUPABASE_KEY:
        d = get_from_supabase()
        if d is not None:
            return d
        log.warning("Supabase unavailable, falling back to local file.")
    return load_local_file()

def save_data(data: Dict[str, Any]) -> bool:
    if SUPABASE_URL and SUPABASE_KEY:
        ok = save_to_supabase(data)
        if ok:
            return True
        log.warning("Saving to Supabase failed; attempting local file save.")
    return save_local_file(data)

# XP/level helper
def add_xp(data: Dict[str, Any], stat: str, xp_amount: int):
    if "stat_progress" not in data:
        data["stat_progress"] = {}
    if stat not in data["stat_progress"]:
        data["stat_progress"][stat] = {"level": 1, "xp": 0}
    sp = data["stat_progress"][stat]
    sp["xp"] += int(xp_amount or 0)
    # level up/down loop
    while sp["xp"] < 0 and sp["level"] > 1:
        sp["level"] -= 1
        sp["xp"] += 100 * sp["level"]
    while sp["xp"] >= 100 * sp.get("level", 1):
        sp["xp"] -= 100 * sp.get("level", 1)
        sp["level"] += 1
    if sp["xp"] < 0:
        sp["xp"] = 0

# === FastAPI app & static ===
app = FastAPI()
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/sw.js")
async def sw():
    fp = os.path.join(STATIC_DIR, "sw.js")
    if os.path.exists(fp):
        return FileResponse(fp, media_type="application/javascript")
    return JSONResponse({"detail": "sw not found"}, status_code=404)

@app.get("/")
async def root():
    fp = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(fp):
        return FileResponse(fp)
    return JSONResponse({"detail": "index not found"}, status_code=404)

# CORS
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.middleware("http")
async def add_version_header(request: Request, call_next):
    resp = await call_next(request)
    try:
        resp.headers["X-App-Version"] = "v11-supabase"
        if request.url.path in ["/", "/index.html", "/static/index.html"]:
            resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    except Exception:
        pass
    return resp

# === API endpoints ===

@app.get("/api/data")
async def api_get_data():
    d = load_data()
    return {"data": d, "missed_day": False, "punishment": None}

@app.post("/api/tasks/add")
async def api_add_task(req: Request):
    body = await req.json()
    task = (body.get("task") or "").strip()
    deadline = (body.get("deadline") or "").strip() or None
    coins = int(body.get("coins") or 5)
    xp = int(body.get("xp") or 0)
    stat = (body.get("stat") or "discipline").strip().lower()
    d = load_data()
    if task:
        d.setdefault("tasks", []).append({
            "task": task,
            "deadline": deadline,
            "done": False,
            "created": now_iso(),
            "coins": coins,
            "xp": xp,
            "stat": stat,
            "failed": False
        })
        save_data(d)
    return {"tasks": d.get("tasks", [])}

@app.post("/api/tasks/toggle/{task_id}")
async def api_toggle_task(task_id: int):
    d = load_data()
    tasks = d.setdefault("tasks", [])
    if task_id < 0 or task_id >= len(tasks):
        return JSONResponse({"error": "Invalid task index"}, status_code=400)
    task = tasks[task_id]
    before = task.get("done", False)
    task["done"] = not before
    if task["done"]:
        d.setdefault("shop", {}).setdefault("coins", 0)
        d["shop"]["coins"] += int(task.get("coins", 5) or 0)
        add_xp(d, task.get("stat", "discipline"), int(task.get("xp", 0) or 0))
        d.setdefault("stats", {})["tasks_completed"] = d.get("stats", {}).get("tasks_completed", 0) + 1
    else:
        d.setdefault("shop", {}).setdefault("coins", 0)
        d["shop"]["coins"] = max(0, d["shop"]["coins"] - int(task.get("coins", 5) or 0))
        add_xp(d, task.get("stat", "discipline"), -int(task.get("xp", 0) or 0))
        d.setdefault("stats", {})["tasks_completed"] = max(0, d.get("stats", {}).get("tasks_completed", 0) - 1)
    save_data(d)
    return {"ok": True, "data": d}

@app.post("/api/tasks/delete/{idx}")
async def api_delete_task(idx: int):
    d = load_data()
    if 0 <= idx < len(d.get("tasks", [])):
        d["tasks"].pop(idx)
        save_data(d)
    return {"tasks": d.get("tasks", [])}

@app.post("/api/punishments/add")
async def api_add_punishment(req: Request):
    body = await req.json()
    txt = (body.get("punishment") or "").strip()
    d = load_data()
    if txt:
        d.setdefault("punishments", []).append(txt)
        save_data(d)
    return {"punishments": d.get("punishments", [])}

@app.get("/api/punishments")
async def api_get_punishments():
    d = load_data()
    return {"punishments": d.get("punishments", [])}

@app.post("/api/punishments/delete/{idx}")
async def api_delete_punishment(idx: int):
    d = load_data()
    if 0 <= idx < len(d.get("punishments", [])):
        d["punishments"].pop(idx)
        save_data(d)
    return {"punishments": d.get("punishments", [])}

@app.post("/api/nonneg/add")
async def api_add_nonneg(req: Request):
    body = await req.json()
    txt = (body.get("rule") or "").strip()
    if not txt:
        return JSONResponse({"error": "Empty"}, status_code=400)
    d = load_data()
    d.setdefault("non_negotiables", []).append({"text": txt, "created": now_iso()})
    save_data(d)
    return {"ok": True, "data": d}

@app.post("/api/nonneg/delete/{idx}")
async def api_delete_nonneg(idx: int):
    d = load_data()
    if idx < 0 or idx >= len(d.get("non_negotiables", [])):
        return JSONResponse({"error": "Invalid index"}, status_code=400)
    d["non_negotiables"].pop(idx)
    save_data(d)
    return {"ok": True, "data": d}

@app.post("/api/nonneg/edit/{idx}")
async def api_edit_nonneg(idx: int, req: Request):
    body = await req.json()
    txt = (body.get("rule") or "").strip()
    d = load_data()
    if idx < 0 or idx >= len(d.get("non_negotiables", [])):
        return JSONResponse({"error": "Invalid index"}, status_code=400)
    if not txt:
        return JSONResponse({"error": "Empty"}, status_code=400)
    d["non_negotiables"][idx]["text"] = txt
    d["non_negotiables"][idx]["modified"] = now_iso()
    save_data(d)
    return {"ok": True, "data": d}

@app.post("/api/diary/add")
async def api_diary_add(req: Request):
    body = await req.json()
    entry = (body.get("entry") or "").strip()
    d = load_data()
    if entry:
        d.setdefault("diary", []).append({"text": entry, "ts": now_iso()})
        save_data(d)
    return {"diary": d.get("diary", [])}

@app.get("/api/shop")
async def api_shop_get():
    d = load_data()
    shop = d.setdefault("shop", {"coins": 0, "items": [], "catalog": []})
    return {"shop": shop, "catalog": shop.get("catalog", [])}

@app.post("/api/shop/buy/{item_id}")
async def api_shop_buy(item_id: int):
    d = load_data()
    catalog = {int(it.get("id")): it for it in d.get("shop", {}).get("catalog", []) if it.get("id") is not None}
    item = catalog.get(item_id)
    if not item:
        return JSONResponse({"error": "Item not found"}, status_code=404)
    if d.get("shop", {}).get("coins", 0) < int(item.get("price", 0)):
        return JSONResponse({"error": "Not enough coins"}, status_code=400)
    d["shop"]["coins"] = d["shop"].get("coins", 0) - int(item.get("price", 0))
    effect = item.get("effect")
    val = item.get("value", None)
    if effect == "skip_punishment":
        if d.get("ongoing_punishments"):
            d["ongoing_punishments"].pop(0)
        else:
            d["shop"]["skip_tokens"] = d["shop"].get("skip_tokens", 0) + (val or 1)
    elif effect == "xp_boost":
        d["shop"]["xp_boost_active"] = True
    elif effect == "extra_time":
        import datetime as _dt
        tasks = [t for t in d.get("tasks", []) if t.get("deadline")]
        try:
            tasks_sorted = sorted(tasks, key=lambda x: x.get("deadline") or "")
            if tasks_sorted:
                td = tasks_sorted[0]["deadline"]
                try:
                    tdt = _dt.datetime.fromisoformat(td)
                    tdt = tdt + _dt.timedelta(minutes=int(val or 60))
                    tasks_sorted[0]["deadline"] = tdt.isoformat()
                except Exception:
                    pass
        except Exception:
            pass
    d["shop"].setdefault("items", [])
    if item.get("name") not in d["shop"]["items"]:
        d["shop"]["items"].append(item.get("name"))
    save_data(d)
    return {"shop": d.get("shop")}

@app.post("/api/settings")
async def api_save_settings(req: Request):
    body = await req.json()
    d = load_data()
    if isinstance(body, dict):
        if "settings" in body and isinstance(body["settings"], dict):
            d.setdefault("settings", {}).update(body["settings"])
        else:
            d.setdefault("settings", {}).update(body)
        save_data(d)
    return {"settings": d.get("settings", {})}

@app.get("/api/stats")
async def api_get_stats():
    d = load_data()
    return {"stats": d.get("stats", {}), "attributes": d.get("attributes", {}), "stat_progress": d.get("stat_progress", {})}

@app.post("/api/ping")
async def api_ping():
    d = load_data()
    today = date.today()
    last = d.get("last_login")
    triggered = None
    lastd = None
    if last:
        try:
            lastd = date.fromisoformat(last.split("T")[0])
        except Exception:
            lastd = None
    if lastd == today:
        pass
    else:
        if lastd is None:
            d["streak"] = 1
            d["best_streak"] = max(d.get("best_streak", 0), d.get("streak", 0))
        else:
            delta = (today - lastd).days
            if delta == 1:
                d["streak"] = d.get("streak", 0) + 1
                d["best_streak"] = max(d.get("best_streak", 0), d.get("streak", 0))
            elif delta > 1:
                d["streak"] = 0
                p = random.choice(d.get("punishments", [])) if d.get("punishments") else None
                if p:
                    d.setdefault("ongoing_punishments", []).append({"text": p, "ts": now_iso()})
                    triggered = p
        d["last_login"] = datetime.now().isoformat()
        save_data(d)
    return {"streak": d.get("streak", 0), "punishment": triggered, "shop": d.get("shop", {}), "ongoing_punishments": d.get("ongoing_punishments", [])}

@app.post("/api/reset")
async def api_reset():
    default = seed_data()
    save_data(default)
    return {"status": "reset", "data": default}
