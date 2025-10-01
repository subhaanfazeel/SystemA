# fix_js_sw.py
import pathlib, shutil, re
BASE = pathlib.Path.cwd()
APP = BASE / "app.js"
SW = BASE / "sw.js"

def write_sw(path):
    sw_code = """\
'use strict';
const CACHE_NAME = "solo-cache-v11.6";
const ASSETS = [
  "/",
  "/static/index.html?v11.6",
  "/static/styles.css?v11.6",
  "/static/app.js?v11.6",
  "/static/sw-register.js?v11.6",
  "/static/manifest.json",
  "/static/icon-192.svg",
  "/static/icon-512.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

// fetch handler: safe clone pattern
self.addEventListener("fetch", event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).then(response => {
      try {
        if (response && response.status === 200 && response.type === "basic") {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            try { cache.put(event.request, responseClone); } catch(e) {}
          });
        }
      } catch(e) { /* swallow cache errors */ }
      return response;
    }).catch(() => caches.match(event.request))
  );
});
"""
    path.write_text(sw_code, encoding="utf-8")
    print(f"Wrote {path}")

def fix_app(path):
    if not path.exists():
        print("app.js not found:", path)
        return
    bak = path.with_suffix(".js.bak")
    if not bak.exists():
        shutil.copy2(path, bak)
        print("Backup created:", bak)
    text = path.read_text(encoding="utf-8")

    # Common quick fixes:
    # 1) remove lines that are a single dot or only whitespace + dot
    text = re.sub(r"(?m)^[\s]*\.[\s]*$\n", "", text)

    # 2) replace accidental double-dots (..) with single dot (common paste error)
    text = text.replace("..", ".")

    # 3) remove stray trailing commas before closing braces ,}
    text = re.sub(r",\s*([\]\}\)])", r"\1", text)

    # 4) remove duplicate consecutive closing braces "}}}" -> "}}"
    text = re.sub(r"\}\s*\}\s*\}", "}\n}\n", text)

    # 5) ensure top-level DOMContentLoaded init exists
    if "DOMContentLoaded" not in text:
        text += "\n\ndocument.addEventListener('DOMContentLoaded', async () => {\n  try { if (typeof loadData === 'function') await loadData(); navigator.serviceWorker?.register('/sw.js?v11.6').catch(()=>{}); } catch(e) { console.error(e); }\n});\n"

    path.write_text(text, encoding="utf-8")
    print("Patched app.js (backup saved).")

if __name__ == '__main__':
    try:
        write_sw(SW)
    except Exception as e:
        print("sw write error:", e)
    try:
        fix_app(APP)
    except Exception as e:
        print("app fix error:", e)
    print("Done. Restart your backend and reload the page.")
