import sys, os, time, json
from playwright.sync_api import sync_playwright
tracks = sys.argv[1].split("|"); levels = sys.argv[2].split(","); auto = (sys.argv[3] if len(sys.argv) > 3 else "auto") == "auto"
JS = """() => ({clock: (window.__btr[0] && 0) || 0, r: (window.__btr||[]).map(r => ({id:r.id, total:r.total, falls:r.falls||0, walls:r.walls||0, hits:r.hits||0, bus:r.bus||0, boosts:r.boostsUsed, spd:r.speed, log:(r.fallLog||[]).slice(0,6), prog:+r.prog.toFixed(3), path:r.path, x:Math.round(r.pos.x), y:+r.y.toFixed(1), z:Math.round(r.pos.z), air:r.airborne, pin:+r.pinnedFor.toFixed(1), stun:+r.stunTimer.toFixed(1), touch:r.touching, drift:r.isDrifting}))})"""
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    for name in tracks:
        for lv in levels:
            errors = []
            ctx = b.new_context(viewport={"width": 400, "height": 250})
            ctx.add_init_script("localStorage.setItem('tsc_settings', JSON.stringify({aiSkill: '%s'}))" % lv)
            pg = ctx.new_page()
            pg.on("pageerror", lambda e: errors.append(str(e)))
            pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            pg.goto("file://" + os.path.abspath("dist/index.html")); pg.wait_for_timeout(500)
            pg.get_by_text("Jugar").first.click(); pg.wait_for_timeout(400)
            pg.get_by_text("Circuitos").first.click(); pg.wait_for_timeout(300)
            pg.get_by_text(name).first.click(); pg.wait_for_timeout(300)
            pg.get_by_text("Empezar Carrera").first.click(); pg.wait_for_timeout(4500)
            pg.evaluate("window.__btrSpeed = 12; window.__btrAuto = %s" % ("true" if auto else "false"))
            t0 = time.time(); last = None; lap_t = {}
            while time.time() - t0 < 110:
                pg.wait_for_timeout(300)
                st = pg.evaluate(JS)
                txt = pg.locator("body").inner_text().split("\n")
                clock = next((x for x in txt if ":" in x and "." in x and len(x) < 10), "0:0")
                m, rest = clock.split(":"); secs = int(m) * 60 + float(rest)
                if not st["r"]: break
                last = st["r"]
                lead = max(r["total"] for r in last[1:])
                if lead >= 2.0 or secs > 260: break
            ai = last[1:]
            lead = max(r["total"] for r in ai); tail = min(r["total"] for r in ai)
            n = len(ai)
            print(f"{name:16s} {lv:8s} t={secs:5.0f}s lead {lead:.2f} ({secs/lead:5.1f} s/lap) tail {tail:.2f} player {last[0]['total']:.2f} | per AI: falls {sum(r['falls'] for r in ai)/n:.1f} walls {sum(r['walls'] for r in ai)/n:.1f} hit {sum(r['hits'] for r in ai)/n:.1f} bus {sum(r['bus'] for r in ai)/n:.1f} boosts {sum(r['boosts'] for r in ai)/n:.1f} | player hit {last[0]['hits']} | errors {len(errors)} {errors[:1]}", flush=True)
            print('     falls:', [r['log'] for r in last if r['log']], '| player', {k: last[0][k] for k in ['prog','path','x','y','z','air','pin','stun','touch','drift','spd']}, flush=True)
            ctx.close()
    b.close()
