import sys, os, io
from playwright.sync_api import sync_playwright
from PIL import Image, ImageStat
names = sys.argv[1].split("|"); tag = sys.argv[2]; upto = [float(x) for x in sys.argv[3].split(",")]
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    for name in names:
        errs = []
        pg = b.new_page(viewport={"width": 1100, "height": 720})
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.goto("file://" + os.path.abspath("dist/index.html")); pg.wait_for_timeout(500)
        pg.get_by_text("Jugar").first.click(); pg.wait_for_timeout(400)
        pg.get_by_text("Circuitos").first.click(); pg.wait_for_timeout(300)
        pg.get_by_text(name).first.click(); pg.wait_for_timeout(300)
        pg.get_by_text("Empezar Carrera").first.click(); pg.wait_for_timeout(6000)
        pg.evaluate("window.__btrAuto = true")
        for k, w in enumerate(upto):
            pg.evaluate("window.__btrSpeed = 30")
            for _ in range(200):
                pg.wait_for_timeout(300)
                if pg.evaluate("window.__btr[0].total") >= w: break
            pg.evaluate("window.__btrSpeed = 0.3"); pg.wait_for_timeout(5000)
            png = pg.screenshot(); f = f"{tag}-{name.split()[0]}-{k}.png"; open(f, "wb").write(png)
            im = Image.open(io.BytesIO(png)).convert("L")
            print(name, "at", w, "brightness whole", round(ImageStat.Stat(im).mean[0]), "sky band", round(ImageStat.Stat(im.crop((300, 120, 800, 260))).mean[0]), "errors", errs[:2], flush=True)
        pg.close()
    b.close()
