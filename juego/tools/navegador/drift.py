import sys, os, time
from playwright.sync_api import sync_playwright
name = sys.argv[1]; lv = sys.argv[2]
JS = """() => (window.__btr||[]).map(r => [r.id, +r.prog.toFixed(3), r.isDrifting?1:0, +r.driftCharge.toFixed(2), +r.turboMeter.toFixed(2), +r.steerSmooth.toFixed(2), +r.speed.toFixed(0), r.boostsUsed, r.touching?1:0, +r.lat.toFixed(1), +r.aiLat.toFixed(1), r.weapon||'-', r.fuseTimer>0?'F':''])"""
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    ctx = b.new_context(viewport={"width": 400, "height": 250})
    ctx.add_init_script("localStorage.setItem('tsc_settings', JSON.stringify({aiSkill: '%s'}))" % lv)
    pg = ctx.new_page()
    pg.goto("file://" + os.path.abspath("dist/index.html")); pg.wait_for_timeout(500)
    pg.get_by_text("Jugar").first.click(); pg.wait_for_timeout(400)
    pg.get_by_text("Circuitos").first.click(); pg.wait_for_timeout(300)
    pg.get_by_text(name).first.click(); pg.wait_for_timeout(300)
    pg.get_by_text("Empezar Carrera").first.click(); pg.wait_for_timeout(4500)
    pg.evaluate("window.__btrSpeed = 2; window.__btrAuto = true")
    n = 0; dr = 0; rows = []
    for i in range(110):
        pg.wait_for_timeout(300)
        st = pg.evaluate(JS)
        for r in st:
            if r[0] == "ai-3": rows.append(r)
            n += 1; dr += r[2]
    for r in rows[::3]: print(*r)
    print("share of samples drifting:", round(dr / n, 3))
    b.close()
