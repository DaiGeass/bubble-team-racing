# Mods de Bubble Team Racing

Un mod es **un archivo JSON** que añade circuitos, estéticas y personajes. Se carga en **Mods** (menú principal): el juego lo comprueba, lo guarda en el navegador y lo aplica la próxima vez que arranca («Reiniciar ahora»). Desde esa pantalla se puede encender, apagar o quitar cada mod. Si algo de un mod no es válido, esa parte se salta y el motivo aparece bajo su nombre; el resto del mod sí entra.

Nada de un mod se ejecuta como código: cada orden se comprueba contra una lista fija. En **Mods → Descargar el ejemplo** hay un mod completo (`mod-ejemplo.json`) para empezar.

## Estructura

```json
{
  "format": "btr-mod",
  "version": 1,
  "id": "mi-mod",
  "name": "Mi mod",
  "author": "Yo",
  "description": "Opcional",
  "themes": [],
  "characters": [],
  "tracks": []
}
```

`id`: minúsculas, cifras, `-` y `_`, hasta 32 caracteres. Las estéticas se aplican primero, así que los circuitos del mismo mod pueden usarlas.

## Estéticas

```json
{ "id": "atardecer-menta", "name": "ATARDECER MENTA", "base": "sunset",
  "skyTop": "#7fe3c4", "skyBottom": "#fff1d6", "barrierA": "#2dd4bf", "barrierB": "#fb923c", "glow": "#99f6e4" }
```

Se copia la estética `base` (`frutiger`, `aero`, `vapor`, `y2k`, `cyberpunk`, `dreamcore`, `eden`, `slime`, `techno`, `sunset`, `weirdcore`, `glitchcore`, `kidcore`, `cottagecore`, `traumacore`, `nightcore`, `aurora`, `level1`, `levelfun`…) y se cambian los campos dados. Los colores van como `#rrggbb`; los campos numéricos de la base también se pueden cambiar (0 a 2000).

## Personajes

```json
{ "id": "menta", "name": "MENTA", "form": "leaf", "eye": "sparkle",
  "primary": "#2dd4bf", "secondary": "#f0fdfa", "accent": "#0f766e",
  "speed": 4, "accel": 3, "handling": 4, "weight": 2,
  "role": "balanced", "favorite": "magnet",
  "shot": { "name": "HOJA FRESCA", "kind": "fan", "effect": "slow", "color": "#2dd4bf", "rate": 1.1, "count": 3, "power": 0.9 } }
```

| Campo | Valores |
| --- | --- |
| `form` | drop, bubble, leaf, crystal, holo, cloud, star, flame, jelly, planet, gear |
| `eye` | sparkle, sharp, visor, sleepy |
| `role` | speed, handler, heavy, balanced, trickster, tech |
| `favorite` | orb, missile, bubble, slime, beam, zap, mine, wave, swap, magnet, ghost, quake, freeze, steal, popup, giant, warp |
| `speed`, `accel`, `handling`, `weight` | 1 a 5 |
| `shot.kind` | bolt, homing, fan, rear, lance, nova, mortar |
| `shot.effect` | stun, spin, slow, freeze, drain, shove, lift, coins, steal, blind, burn, tug |
| `shot.rate` / `count` / `power` | 0.4–4 / 1–6 / 0.2–2 |

`shot` (el disparo propio) es opcional.

## Circuitos

Un circuito se dibuja con una **tortuga**: empieza en `start` (`[x, y, z, rumbo]`, por defecto `[0, 10, 0, 0]`) y avanza con órdenes. Cada orden es una lista que empieza por su nombre:

| Orden | Qué hace |
| --- | --- |
| `["go", largo, subida?]` | recta de `largo` metros, subiendo o bajando `subida` |
| `["toY", largo, altura]` | recta que llega a la altura dada |
| `["left", grados, radio, subida?]` / `["right", …]` | curva |
| `["mark", "nombre"]` | marca un punto para usarlo en zonas, rutas, saltos… |
| `["flex", "nombre", largo, subida?]` | recta **flexible**: el juego ajusta su largo para cerrar la vuelta |
| `["weave", "L"\|"R", grados, radio, subida?]` | eses: sale hacia un lado y vuelve, sin cambiar el rumbo |
| `["bypass", "L"\|"R", tramo, altura, desnivel?]` | (en rutas) se separa de la carretera principal, corre a su lado `tramo` metros a `altura` por encima (o por debajo) y vuelve; cubre 177 + `tramo` metros de la recta |
| `["cut", "L"\|"R", diagonal, radio?, subida?]` | (en rutas) atajo en diagonal por dentro de una curva de 90° |
| `["drop", caída]` | escalón hacia abajo (−2 a −40) |

**El circuito tiene que cerrarse.** Pon dos `flex` cuyos rumbos **no** sean paralelos (por ejemplo uno antes y otro después de una curva de 90°): el juego ajusta su largo para que la vuelta termine donde empezó. Si apuntan igual, el circuito se rechaza con ese motivo.

Otros campos:

| Campo | Ejemplo | Qué es |
| --- | --- | --- |
| `name` | `"Pista"` o `{ "es": "Pista", "en": "Track" }` | nombre, por idioma |
| `theme` | `"sunset"` o una estética del mod | aspecto |
| `difficulty` | 1, 2, 3 | |
| `zones` | `[["a", "b", "water"]]` | tramo entre marcas: `water`, `sky`, `sub`, `mag` |
| `holes` | `[["a", 14]]` | hueco de 14 m en la marca |
| `pads` | `[["a", "boost", 1.4], ["b", "jump", 11]]` | impulsor o salto en la marca |
| `cannons` | `[["a", "b", 30]]` | cañón de una marca a otra |
| `portals` | `[["a", "b"]]` | portal |
| `sectors` | `[["a", "vapor"]]` | cambia la estética desde la marca |
| `routes` | ver abajo | carreteras alternativas |
| `traffic`, `hazards` | 0–4 | tráfico y obstáculos |
| `sea`, `indoor`, `warp`, `traps` | | nivel del mar, interior, deformación (`true`, `false`, `"soft"`), pinchos deslizantes |

Rutas:

```json
{ "from": "aA", "to": "aB", "draw": [["bypass", "L", 123, 9]], "kind": "high",
  "holes": [["mid", 12]], "pads": [["mid", "boost", 1.5]] }
```

`kind`: `high`, `low`, `cut`, `side`. También `width`, `walls`, `tunnel`, `afloat`. Una ruta empieza en la marca `from` y debe acabar en la marca `to`; dentro hay una marca `mid` a medio camino.

El id final del circuito es `mod-<id del mod>-<id del circuito>`.
