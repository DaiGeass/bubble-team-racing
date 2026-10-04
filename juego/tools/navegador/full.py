import sys, os, time, json
from playwright.sync_api import sync_playwright
tracks = sys.argv[1].split("|")
speed = float(sys.argv[2]) if len(sys.argv) > 2 else 40
JS = """() => (window.__btr||[]).map(r => ({id:r.id, total:+r.total.toFixed(2), falls:r.falls||0, log:(r.fallLog||[]).slice(0,8), hit:r.stunTimer>0}))"""
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    for name in tracks:
        errors = []
        pg = b.new_page(viewport={"width": 400, "height": 250})
        pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errors.append("PAGEERROR " + str(e)))
        pg.goto("file://" + os.path.abspath("dist/index.html")); pg.wait_for_timeout(500)
        pg.get_by_text("Jugar").first.click(); pg.wait_for_timeout(400)
        pg.get_by_text("Circuitos").first.click(); pg.wait_for_timeout(300)
        pg.get_by_text(name).first.click(); pg.wait_for_timeout(300)
        pg.get_by_text("Empezar Carrera").first.click(); pg.wait_for_timeout(4500)
        pg.evaluate(f"window.__btrSpeed = {speed}; window.__btrAuto = true")
        t0 = time.time(); st = []; fin = False; last = []
        while time.time() - t0 < 150:
            pg.wait_for_timeout(1500)
            st = pg.evaluate(JS)
            txt = " ".join(pg.locator("body").inner_text().split("\n"))
            if st: last = st
            if "Resultados" in txt or "Carrera Terminada" in txt or "Volver a Correr" in txt or not st: fin = True; break
        res = " ".join(pg.locator("body").inner_text().split("\n"))[:160] if fin else ""
        print(f"{name:18s} finished {fin} in {time.time()-t0:.0f}s | " + " ".join(f"{r['id'][-2:]}:{r['total']}/f{r['falls']}" for r in last) + f" | errors {len(errors)} {errors[:2]}", flush=True)
        for r in last:
            if r["log"]: print("     ", r["id"], r["log"], flush=True)
        if res: print("      results:", res, flush=True)
        pg.close()
    b.close()
