import os, sys
from playwright.sync_api import sync_playwright
from PIL import Image
# garage.py "Name 1|Name 2|..." out.png : clicks each garage button and tiles the preview
names = sys.argv[1].split("|"); out = sys.argv[2]
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": 1100, "height": 1700})
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    pg.goto("file://" + os.path.abspath("dist/index.html")); pg.wait_for_timeout(500)
    pg.get_by_text("Jugar").first.click(); pg.wait_for_timeout(400)
    pg.get_by_text("⚙").first.click(); pg.wait_for_timeout(600)
    tiles = []
    for n in names:
        pg.get_by_role("button", name=n).first.click(); pg.wait_for_timeout(1100)
        c = pg.locator("canvas").first
        c.screenshot(path="g.png"); tiles.append(Image.open("g.png").convert("RGB").resize((300, 300)))
    sheet = Image.new("RGB", (300 * len(tiles), 300))
    for i, t in enumerate(tiles): sheet.paste(t, (i * 300, 0))
    sheet.save(out)
    print("errors", errors[:3])
    b.close()
