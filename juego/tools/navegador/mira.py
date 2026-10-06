import os
from playwright.sync_api import sync_playwright
# on the grid everyone is close: fuse, take the turret, turn it, and look at the sight and the camera
ST = "() => { const r = window.__btr[0]; return {pair: !!r.pair, gunner: !!(r.pair && r.pair.gunner === r), aim: r.pair ? +r.pair.aim.toFixed(2) : 0}; }"
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": 960, "height": 540}); errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto("file://" + os.path.abspath("dist/index.html")); pg.wait_for_timeout(500)
    pg.get_by_text("Jugar").first.click(); pg.wait_for_timeout(400)
    pg.get_by_text("Empezar Carrera").first.click(); pg.wait_for_timeout(5200)
    pg.keyboard.down("w"); pg.wait_for_timeout(700)
    for k in range(6):
        pg.keyboard.press("f"); pg.wait_for_timeout(500)
        if pg.evaluate(ST)["pair"]: break
    print("fused", pg.evaluate(ST))
    for k in range(8):
        if pg.evaluate(ST)["gunner"]: break
        pg.wait_for_timeout(900); pg.keyboard.down("q"); pg.wait_for_timeout(120); pg.keyboard.up("q"); pg.wait_for_timeout(500)
    print("seat", pg.evaluate(ST))
    pg.screenshot(path="mira-0.png")
    pg.keyboard.down("ArrowLeft"); pg.wait_for_timeout(900); pg.keyboard.up("ArrowLeft"); pg.wait_for_timeout(500)
    print("turned", pg.evaluate(ST))
    pg.screenshot(path="mira-1.png")
    print("errors", errors[:3])
    b.close()
