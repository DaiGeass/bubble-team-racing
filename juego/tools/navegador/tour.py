import sys, os, time, json
from playwright.sync_api import sync_playwright
tracks = sys.argv[1].split("|")
speed = float(sys.argv[2]) if len(sys.argv) > 2 else 12
JS = """() => (window.__btr||[]).map(r => ({id:r.id, total:+r.total.toFixed(3), y:+r.y.toFixed(1), mode:r.mode, path:r.path}))"""
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    for name in tracks:
        errors = []
        pg = b.new_page(viewport={"width": 480, "height": 300})
        pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errors.append("PAGEERROR " + str(e)))
        pg.goto("file://" + os.path.abspath("dist/index.html")); pg.wait_for_timeout(500)
        pg.get_by_text("Jugar").first.click(); pg.wait_for_timeout(400)
        pg.get_by_text("Circuitos").first.click(); pg.wait_for_timeout(300)
        pg.get_by_text(name).first.click(); pg.wait_for_timeout(300)
        pg.get_by_text("Empezar Carrera").first.click(); pg.wait_for_timeout(4500)
        pg.screenshot(path=f"tour-{name.split()[0]}-0.png")
        pg.evaluate(f"window.__btrSpeed = {speed}")
        t0 = time.time(); modes = set(); routes = set(); ymin = 1e9; ymax = -1e9; st = []; clock = "?"; shots = 0
        while time.time() - t0 < 75:
            pg.wait_for_timeout(1200)
            st = pg.evaluate(JS)
            if not st: break
            for r in st[1:]:
                modes.add(r["mode"]); ymin = min(ymin, r["y"]); ymax = max(ymax, r["y"])
                if r["path"] > 0: routes.add(r["path"])
            txt = pg.locator("body").inner_text().split("\n")
            clock = next((x for x in txt if ":" in x and "." in x and len(x) < 10), "?")
            best = max(r["total"] for r in st[1:])
            if best > 1.15: break
        ai = [r["total"] for r in st[1:]]
        sys.stdout.flush(); print(f"{name:20s} clock {clock} AI laps {min(ai):.2f}..{max(ai):.2f} modes {sorted(modes)} routes {sorted(routes)} y {ymin:.0f}..{ymax:.0f} errors {len(errors)} {errors[:2]}")
        pg.close()
    b.close()
