import os, sys, time, subprocess
from playwright.sync_api import sync_playwright
# red.py [battle] : two browsers in one room against the scratch server
battle = len(sys.argv) > 1 and sys.argv[1] == "battle"
PORT = 8799
os.makedirs("servidor", exist_ok=True)
src = "/home/DaiGeass/Descargas/Bubble Team Reacing/juego/servidor/servidor.mjs"
open("servidor/servidor.mjs", "w").write(open(src).read())
srv = subprocess.Popen(["node", "servidor/servidor.mjs", str(PORT)], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
time.sleep(1.2)
JS = """() => (window.__btr||[]).map(r => r.id + (r.remote?'~':'') + ' ' + r.total.toFixed(2) + ' L' + r.lives + (r.out?'x':'') + (r.finished?'F':'') + ' (' + Math.round(r.pos.x) + ',' + Math.round(r.pos.z) + ')').join(' | ')"""
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        pages = []; errs = [[], []]
        for i in range(2):
            pg = b.new_context(viewport={"width": 900, "height": 520}).new_page()
            pg.on("pageerror", lambda e, i=i: errs[i].append(str(e)))
            pg.on("console", lambda m, i=i: errs[i].append(m.text) if m.type == "error" else None)
            pg.goto(f"http://localhost:{PORT}/"); pg.wait_for_timeout(700)
            pg.get_by_text("Multijugador").first.click(); pg.wait_for_timeout(900)
            pages.append(pg)
        host, guest = pages
        guest.get_by_text("VOLT").first.click(); guest.wait_for_timeout(400)
        if battle:
            host.get_by_role("button", name="Batalla").first.click(); host.wait_for_timeout(300)
        else:
            host.get_by_role("button", name="Sprint").first.click(); host.wait_for_timeout(300)
        host.wait_for_timeout(500)
        host.screenshot(path="red-sala-host.png"); guest.screenshot(path="red-sala-guest.png")
        print("guest sees:", " ".join(guest.locator("body").inner_text().split("\n"))[:230])
        host.get_by_text("Empezar").last.click()
        for pg in pages: pg.wait_for_timeout(2500)
        for pg in pages: pg.evaluate("window.__btrAuto = true; window.__btrSpeed = 5")
        host.wait_for_timeout(2500)
        t0 = time.time(); shot = False
        while time.time() - t0 < (170 if battle else 150):
            host.wait_for_timeout(4000)
            a = host.evaluate(JS); c = guest.evaluate(JS)
            print(f"{time.time()-t0:4.0f}s H: {a}\n      G: {c}", flush=True)
            if not shot and time.time() - t0 > 14:
                host.screenshot(path="red-host.png"); guest.screenshot(path="red-guest.png"); shot = True
            th = " ".join(host.locator("body").inner_text().split("\n")); tg = " ".join(guest.locator("body").inner_text().split("\n"))
            if "Volver a la sala" in th and "Volver a la sala" in tg: print("both at results"); break
        for i, pg in enumerate(pages):
            print(["HOST", "GUEST"][i], "|", " ".join(pg.locator("body").inner_text().split("\n"))[:120], "| errors", errs[i][:3])
        b.close()
finally:
    srv.terminate()
    print("server said:", (srv.stdout.read() or "")[-400:])
