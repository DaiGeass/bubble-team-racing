import sys, os, time, io
from playwright.sync_api import sync_playwright
from PIL import Image, ImageStat
tracks = sys.argv[1].split("|")
JS = "() => { const r = window.__btr && window.__btr[0]; return r ? [+r.total.toFixed(2), r.mode, +r.y.toFixed(0), r.airborne] : null }"
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    for name in tracks:
        errors = []
        pg = b.new_page(viewport={"width": 480, "height": 300})
        pg.on("console", lambda m: errors.append(m.text) if m.type in ("error", "warning") else None)
        pg.on("pageerror", lambda e: errors.append("PAGEERROR " + str(e)))
        pg.goto("file://" + os.path.abspath("dist/index.html")); pg.wait_for_timeout(500)
        pg.get_by_text("Jugar").first.click(); pg.wait_for_timeout(400)
        pg.get_by_text("Circuitos").first.click(); pg.wait_for_timeout(300)
        pg.get_by_text(name).first.click(); pg.wait_for_timeout(300)
        pg.get_by_text("Empezar Carrera").first.click(); pg.wait_for_timeout(4500)
        pg.evaluate("window.__btrSpeed = 7; window.__btrAuto = true")
        t0 = time.time(); rows = []
        while time.time() - t0 < 85:
            pg.wait_for_timeout(700)
            st = pg.evaluate(JS)
            if not st: break
            png = pg.screenshot()
            im = Image.open(io.BytesIO(png)).convert("L")
            # the 3D view without the HUD corners: a band across the middle
            mid = im.crop((40, 110, 300, 290))
            lum = ImageStat.Stat(mid).mean[0]
            rows.append((lum, st, png))
            if st[0] >= 3: break
        rows.sort(key=lambda r: r[0])
        lums = [r[0] for r in rows]
        dark = [r for r in rows if r[0] < 28]
        print(f"{name:18s} frames {len(rows)} brightness min {lums[0]:.0f} median {lums[len(lums)//2]:.0f} max {lums[-1]:.0f} | under 28: {len(dark)} at {[r[1][0] for r in dark[:8]]} | console {len(errors)} {errors[:2]}", flush=True)
        open(f"dark-{name.split()[0]}.png", "wb").write(rows[0][2])
        pg.close()
    b.close()
