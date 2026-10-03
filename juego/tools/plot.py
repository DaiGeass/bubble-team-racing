#!/usr/bin/env python3
"""Top-down picture of every circuit, coloured by height. Run tools/sim.sh dump first.
   tools/plot.py [track ...]  ->  /tmp/btr-<track>.png"""
import json, sys
from PIL import Image, ImageDraw
data = json.load(open("/tmp/btr-tracks.json"))
for tid, trk in data.items():
    if len(sys.argv) > 1 and tid not in sys.argv[1:]: continue
    xs = [v for p in trk["paths"] for v in p["x"]]; zs = [v for p in trk["paths"] for v in p["z"]]; ys = [v for p in trk["paths"] for v in p["y"]]
    S = 760; pad = 40
    sc = min((S - 2 * pad) / (max(xs) - min(xs) or 1), (S - 2 * pad) / (max(zs) - min(zs) or 1))
    X = lambda x: pad + (x - min(xs)) * sc
    Z = lambda z: pad + (z - min(zs)) * sc
    lo, hi = min(ys), max(ys)
    img = Image.new("RGB", (S, S), (245, 245, 250)); d = ImageDraw.Draw(img)
    segs = []
    for pi, p in enumerate(trk["paths"]):
        n = len(p["x"])
        for i in range(n - 1 if pi else n):
            j = (i + 1) % n
            if not (p["solid"][i] and p["solid"][j]): continue
            segs.append(((p["y"][i] + p["y"][j]) / 2, pi, p, i, j))
    segs.sort(key=lambda s: s[0])
    for h, pi, p, i, j in segs:
        u = (h - lo) / ((hi - lo) or 1)
        zone = None
        if pi == 0:
            for zn in trk["zones"]:
                if zn["t0"] <= p["prog"][i] <= zn["t1"]: zone = zn["type"]
        col = (int(40 + 215 * u), int(90 + 60 * (1 - u)), int(220 * (1 - u))) if pi == 0 else (int(40 + 200 * u), 170, 90)
        if zone == "water": col = (60, 190, 230)
        if zone == "sky": col = (250, 200, 60)
        if zone == "sub": col = (30, 60, 160)
        w = max(2, int(p["half"] * 2 * sc))
        a = (X(p["x"][i]), Z(p["z"][i])); b = (X(p["x"][j]), Z(p["z"][j]))
        d.line([a, b], fill=(20, 20, 30), width=w + 3)
        d.line([a, b], fill=col, width=w)
    m = trk["paths"][0]
    for k in range(0, len(m["x"]), max(1, len(m["x"]) // 20)):
        d.text((X(m["x"][k]) + 6, Z(m["z"][k]) - 4), f'{m["prog"][k]:.2f} y{m["y"][k]:.0f}', fill=(0, 0, 0))
    d.ellipse([X(m["x"][0]) - 5, Z(m["z"][0]) - 5, X(m["x"][0]) + 5, Z(m["z"][0]) + 5], fill=(255, 255, 255), outline=(0, 0, 0))
    d.text((8, 8), f"{tid}  y {lo:.0f}..{hi:.0f}  (blue low, red high; green = routes)", fill=(0, 0, 0))
    img.save(f"/tmp/btr-{tid}.png")
    print("wrote", f"/tmp/btr-{tid}.png")
