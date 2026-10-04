import os, time
from playwright.sync_api import sync_playwright
from PIL import Image
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    ctx = b.new_context(viewport={"width": 900, "height": 560})
    ctx.add_init_script("localStorage.setItem('tsc_settings', JSON.stringify({aiSkill: 'rookie'}))")
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto("file://" + os.path.abspath("dist/index.html")); pg.wait_for_timeout(500)
    pg.get_by_text("Jugar").first.click(); pg.wait_for_timeout(400)
    pg.get_by_text("Circuitos").first.click(); pg.wait_for_timeout(300)
    pg.get_by_text("Cráter").first.click(); pg.wait_for_timeout(300)
    pg.get_by_text("Empezar Carrera").first.click(); pg.wait_for_timeout(5000)
    pg.evaluate("window.__btrAuto = true; window.__btrSpeed = 30")
    t0 = time.time()
    while time.time() - t0 < 120:
        pg.wait_for_timeout(200)
        if pg.evaluate("window.__btr[0].total") >= 2.96: break
    pg.evaluate("window.__btrSpeed = 1")
    shots = []
    for i in range(40):
        pg.wait_for_timeout(350)
        txt = pg.locator("body").inner_text()
        if "Carrera Terminada" in txt:
            f = f"win-{len(shots)}.png"; pg.screenshot(path=f); shots.append(f)
            if len(shots) == 3: break
    W = Image.new("RGB", (900 * max(1, len(shots)), 560))
    for k, f in enumerate(shots): W.paste(Image.open(f), (k * 900, 0))
    W.resize((600 * max(1, len(shots)), 373)).save("win.png")
    print("shots", len(shots), "errors", errs[:2])
    b.close()
