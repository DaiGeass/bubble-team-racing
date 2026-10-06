import os, sys, time
from playwright.sync_api import sync_playwright
teams = len(sys.argv) > 1 and sys.argv[1] == "teams"
JS = """() => (window.__btr||[]).map(r => r.id.slice(-2) + ':' + r.lives + (r.turretMod ? '[' + r.turretMod + ']' : '') + (r.out ? 'x' : '') + (r.team >= 0 ? 't' + r.team : '')).join(' ')"""
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": 960, "height": 540}); errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    pg.goto("file://" + os.path.abspath("dist/index.html")); pg.wait_for_timeout(500)
    pg.get_by_text("Jugar").first.click(); pg.wait_for_timeout(400)
    pg.get_by_text("Elegir Modo").first.click(); pg.wait_for_timeout(300)
    pg.get_by_text("Batalla").first.click(); pg.wait_for_timeout(300)
    if teams: pg.get_by_text("Dos equipos").first.click(); pg.wait_for_timeout(200)
    pg.screenshot(path="battle-menu.png")
    pg.get_by_text("Empezar Carrera").first.click(); pg.wait_for_timeout(4500)
    pg.evaluate("window.__btrSpeed = 10; window.__btrAuto = true")
    t0 = time.time(); shot = False; fin = False
    while time.time() - t0 < 200:
        pg.wait_for_timeout(1500)
        txt = " ".join(pg.locator("body").inner_text().split("\n"))
        if "Volver a Correr" in txt or "Resultados" in txt: fin = True; break
        st = pg.evaluate(JS)
        if not st: fin = True; break
        print(f"{time.time()-t0:4.0f}s", st, flush=True)
        if not shot and time.time() - t0 > 12:
            pg.evaluate("window.__btrSpeed = 0.2"); pg.wait_for_timeout(500); pg.screenshot(path="battle.png"); pg.evaluate("window.__btrSpeed = 10"); shot = True
    pg.wait_for_timeout(1500)
    print("finished", fin, "|", " ".join(pg.locator("body").inner_text().split("\n"))[:160], "| errors", errors[:3])
    b.close()
