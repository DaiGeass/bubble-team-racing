import sys, os, time
from playwright.sync_api import sync_playwright
# shot.py <track name> <js condition on r (the player)> <out prefix> [count]
name = sys.argv[1]; cond = sys.argv[2]; out = sys.argv[3]; n = int(sys.argv[4]) if len(sys.argv) > 4 else 2
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    ctx = b.new_context(viewport={"width": 960, "height": 540})
    ctx.add_init_script("localStorage.setItem('tsc_settings', JSON.stringify({aiSkill: 'ace'}))")
    pg = ctx.new_page()
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    pg.goto("file://" + os.path.abspath("dist/index.html")); pg.wait_for_timeout(500)
    pg.get_by_text("Jugar").first.click(); pg.wait_for_timeout(400)
    pg.get_by_text("Circuitos").first.click(); pg.wait_for_timeout(300)
    pg.get_by_text(name).first.click(); pg.wait_for_timeout(300)
    pg.get_by_text("Empezar Carrera").first.click(); pg.wait_for_timeout(4500)
    pg.evaluate("window.__btrSpeed = 6; window.__btrAuto = true")
    k = 0; t0 = time.time()
    while k < n and time.time() - t0 < 170:
        pg.wait_for_timeout(100)
        if pg.evaluate("() => { const r = window.__btr && window.__btr[0]; return !!(r && (%s)); }" % cond):
            pg.evaluate("window.__btrSpeed = 0.15"); pg.wait_for_timeout(700)
            pg.screenshot(path=f"{out}-{k}.png"); k += 1
            pg.evaluate("window.__btrSpeed = 6"); pg.wait_for_timeout(1500)
    print(name, "shots", k, "errors", errors[:2])
    b.close()
