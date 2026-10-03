# Bubble Team Racing

Aero kart racing for the browser and the desktop: fourteen circuits that climb, drop
through gaps and split into stacked shortcuts, twenty-eight characters, twenty-four
chassis, six finishes and a partner who mans the fusion turret.

Built with React 19, TypeScript, Vite, React Three Fiber and Tauri 2. The whole game
ships as a single self-contained HTML file, and the desktop builds wrap that same file
in a native window.

## Play it

| Platform | File |
|---|---|
| Windows | `Bubble Team Racing_1.0.0_x64-setup.exe` (NSIS) or `Bubble Team Racing_1.0.0_x64_en-US.msi` (WiX) |
| Linux | `bubble-team-racing_1.0.0_amd64.deb` or `bubble-team-racing_1.0.0_amd64.AppImage` |

Grab them from the [Releases page](https://github.com/DaiGeass/bubble-team-racing/releases).
AppImage runs straight away:

```sh
chmod +x bubble-team-racing_1.0.0_amd64.AppImage
./bubble-team-racing_1.0.0_amd64.AppImage
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

- **14 circuits** of roughly 2000 units, normalised so an AI lap lands between 60 and 90
  seconds, each with vertical relief, a palette that mutates every lap and a themed sky.
- **Real gaps**: a driveable ramp, a lip, a pit and a far wall, with the physics and the
  road mesh sharing one profile. Fall in and you get fished back to the far lip.
- **Stacked routes**: eleven to fourteen shortcuts per lap, from low barriers to raised
  skyways, plus two portals that throw you a short hop ahead.
- **28 characters**, each with its own fusion turret signature: cadence, salvo size, fan
  angle and hit weight.
- **24 chassis**, **7 + 7 + 7 water, air and sub craft** with real stats, and **6 finishes**
  (solid, gloss, matte, chrome, glass and holographic).
- **Six modes**: quick race, time trial, team chaos, sprint, duel and endurance.
- **Eight languages** including Hebrew and Arabic with proper RTL layout.
- Destruction that drops chassis panels onto the road, three mini-turbo levels, camera
  height per craft, a respawn system for walls and dead ends, and options that are
  actually wired to the simulation.

## Layout

```
juego/src            React + Three.js game
juego/src/game       Scene (physics, AI, items), Track, Vehicle, particles
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