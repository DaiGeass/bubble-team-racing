#!/bin/sh
# scratch build of the project sources with the test hook injected
S=/tmp/claude-1000/-home-DaiGeass-Descargas-Bubble-Team-Reacing/a763eeeb-c59d-457d-a36b-9756b2f524e6/scratchpad/w
P="/home/DaiGeass/Descargas/Bubble Team Reacing/juego"
rm -rf $S/src && cp -r "$P/src" $S/src && cd $S && python3 - <<'PY'
p='src/game/Scene.tsx'
s=open(p).read()
a='    const span = Math.min(deltaRaw, 0.1);'
assert a in s
s=s.replace(a,'    const span = Math.min(deltaRaw, 0.1) * ((window as unknown as { __btrSpeed?: number }).__btrSpeed ?? 1);')
a='    raceSnapshot.theme = theme;'
s=s.replace(a,'    (window as unknown as { __btr?: unknown }).__btr = racers;\n'+a,1)
for a,b in [
 ('    if (r.isPlayer && controls) {\n      // camera faces','    if (r.isPlayer && controls && !(window as unknown as { __btrAuto?: boolean }).__btrAuto) {\n      // camera faces'),
 ('    } else if (!r.isPlayer) {\n      // every opponent','    } else if (!r.isPlayer || (window as unknown as { __btrAuto?: boolean }).__btrAuto) {\n      // every opponent'),
 ('    r.lastFall = raceClock.current;\n','    r.lastFall = raceClock.current;\n    const w = r as unknown as { falls?: number; fallLog?: string[] }; w.falls = (w.falls ?? 0) + 1; (w.fallLog ??= []).push(r.prog.toFixed(3) + (r.airborne ? "a" : r.pinnedFor > 2.5 ? "p" : "n") + "/" + r.path);\n'),
 ('    if (stepRes.wallFirst && stepRes.wallImpact > 0.12 && r.bumpCd <= 0) {','    if (stepRes.wallFirst && stepRes.wallImpact > 0.12) { const w2 = r as unknown as { walls?: number }; w2.walls = (w2.walls ?? 0) + 1; }\n    if (stepRes.wallFirst && stepRes.wallImpact > 0.12 && r.bumpCd <= 0) {'),
 ('    r.lastHit = raceClock.current;\n','    r.lastHit = raceClock.current;\n    { const w3 = r as unknown as { hits?: number }; w3.hits = (w3.hits ?? 0) + 1; }\n'),
 ('          r.bumpCd = 0.7;\n          r.speed *= 0.5;','          { const w4 = r as unknown as { bus?: number }; w4.bus = (w4.bus ?? 0) + 1; }\n          r.bumpCd = 0.7;\n          r.speed *= 0.5;'),
]:
    assert a in s, a[:40]
    s=s.replace(a,b)
open(p,'w').write(s)
PY
node_modules/.bin/vite build --configLoader runner 2>&1 | grep -i "error\|built"
