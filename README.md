# Bubble Team Racing

Aero kart racing for the browser and the desktop: eight hand-built circuits with spiral
towers, bridges, jumps, cannons, flights and dives, twenty-eight characters, nineteen
chassis, six finishes and a partner who mans the fusion turret.

Built with React 19, TypeScript, Vite, React Three Fiber and Tauri 2. The whole game
ships as a single self-contained HTML file, and the desktop builds wrap that same file
in a native window.

## Play it

| Platform | File on the release | Size |
|---|---|---|
| Windows installer | `Bubble.Team.Racing_1.1.1_x64-setup.exe` (NSIS, English/Spanish selector) | ~2.3 MB |
| Windows MSI | `Bubble.Team.Racing_1.1.1_x64_en-US.msi` or `_x64_es-ES.msi` (WiX) | ~3.3 MB |
| Linux package | `Bubble.Team.Racing_1.1.1_amd64.deb` | ~3.3 MB |
| Linux portable | `Bubble.Team.Racing_1.1.1_amd64.AppImage` | ~82 MB |

Grab them from the [Releases page](https://github.com/DaiGeass/bubble-team-racing/releases).
The AppImage runs straight away:

```sh
chmod +x Bubble.Team.Racing_1.1.1_amd64.AppImage
./Bubble.Team.Racing_1.1.1_amd64.AppImage
```

Or install the package:

```sh
sudo apt install ./Bubble.Team.Racing_1.1.1_amd64.deb
```

## Run it in a browser

```sh
cd juego
npm install
npm run dev          # http://localhost:5173
npm run build        # single file in juego/dist/index.html
```

Open `juego/dist/index.html` directly and it works offline, no server needed.

## Build the desktop apps

```sh
cd juego
npm install
npm run desktop            # dev window with hot reload
npm run dist:linux         # .deb + .AppImage
npm run dist:windows       # .exe (NSIS) + .msi (WiX), on Windows
```

Linux needs the usual Tauri prerequisites (`libwebkit2gtk-4.1-dev`, `libgtk-3-dev`,
`librsvg2-dev`, `patchelf`, `libssl-dev`, `build-essential`). The bundle targets live in
`juego/src-tauri/tauri.conf.json`; the Windows installers are produced by CI because
MSI cannot be cross-compiled from Linux.

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Steer | `A`/`D` or arrows | left half of the screen |
| Accelerate | `W` or `↑` | right pedal |
| Brake / reverse | `S` or `↓` | left pedal |
| Drift | `Space` | drift button |
| Item | `Space` when armed | item button |
| Turbo | `K` | turbo button |
| Swap team | `Q` | swap button |
| Fusion turret | `F` | fusion button |

Every keyboard key and every one of the eight touch zones can be reassigned in
Options, with three control presets that install a full layout at once.

## What's in the game

- **8 circuits, one per aesthetic**, drawn by hand in real 3D (`juego/src/tracks.ts`):
  roads pass over and under each other, wind up spiral towers and drop off falls. Laps
  run 2150 to 2800 units.
- **Alternate routes at other heights**: a road above and a road below the main one,
  each with its own tarmac and barriers, plus an open chute with a gap in it.
- **Jumps, falls and cannons**: a gap is road that is not there, with a lip that
  launches; miss it and you are put back with a run-up. Cannons fire you over a corner
  or back up to the top of a waterfall.
- **Flying and diving for real**: in the air the pedals climb and dive to thread the
  rings; submarine stretches go down a tube to twenty units under the sea.
- **Barriers you slide along**: a graze costs next to nothing, a head-on hit costs most
  of your speed. Karts shove each other and the heavier one gives way less.
- **28 characters**, each with its own fusion turret signature: cadence, salvo size, fan
  angle and hit weight.
- **19 chassis**, **7 + 7 + 7 water, air and sub craft** with real stats, and **6 finishes**
  (solid, gloss, matte, chrome, glass and holographic).
- **Six modes**: quick race, time trial, team chaos, sprint, duel and endurance.
- **Eight languages** including Hebrew and Arabic with proper RTL layout.
- Destruction that drops chassis panels onto the road, three mini-turbo levels, camera
  height per craft, a respawn system for walls and dead ends, and options that are
  actually wired to the simulation.

## Layout

```
juego/src            React + Three.js game
juego/src/game       Scene (race rules, AI, items), Track, Vehicle, particles
juego/src/physics.ts ground, barriers, gravity, lap progress: no rendering, runs headless
juego/src/tracks.ts  the circuits, drawn with the designer in trackDesign.ts
juego/tools          headless simulator, geometry checker and track plotter
juego/src/screens    menus, garage, options, HUD, overlays
juego/src-tauri      desktop shell (Rust) and bundle configuration
AUDITORIA.md         what came from which of the four source zips, and how it was measured
```

`AUDITORIA.md` is the design record: which system was taken from which archive, why, and
the measurements behind every claim.

## Licence

GNU General Public License v3.0 or later. The full text is in [LICENSE](LICENSE), and the
same notice travels with the installers, so anyone who gets a copy of the game also gets
the source and the freedom to modify and redistribute it.

```
Bubble Team Racing - aero kart racing
Copyright (C) 2026  Bubble Team

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
```

Source for every published build: <https://github.com/DaiGeass/bubble-team-racing>