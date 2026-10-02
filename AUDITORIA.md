# AUDITORIA — unificación de las versiones del juego

> Documento vivo. Al final de cada fase se actualiza con lo hecho y lo pendiente.

## 0. Qué hay realmente en la carpeta

El encargo hablaba de `version-a` y `version-b`, pero en la carpeta hay **4 ZIP**.
Al compararlos archivo a archivo se agrupan en **dos linajes distintos** (dos modelos):

| ZIP | Fecha | Linaje | Distintos frente a la base |
|---|---|---|---|
| `frutiger-aero-3d-racer.zip` | 07:20 | **A** (base) | — (referencia) |
| `frutiger-aero-3d-racer (1).zip` | 08:01 | **A** | 9 ficheros + 2 nuevos (`Models2.tsx`, `i18n6.ts`) |
| `frutiger-aero-3d-racer (2).zip` | 08:13 | **A** | 5 ficheros (añade la carrocería `mono`) |
| `frutiger-aero-3d-racer (3).zip` | 08:22 | **B** | 14–15 ficheros, reorganiza el proyecto entero |

Criterio del agrupamiento: `base`, `(1)` y `(2)` se diferencian en **5–10** ficheros
(reescrituras del mismo estilo, misma arquitectura, mismos nombres internos). `(3)` se
diferencia de **todos** en 14–15, borra `Models.tsx`, reescribe `trackCurve.ts`,
`RaceCanvas.tsx`, `Minimap.tsx`, `HUD.tsx`, `CharacterPreview.tsx` e `index.css`, y cambia
el modelo de datos (`waterCraft`/`airCraft` unificados, `branches`). Eso es otro modelo.

**Naming que usaré en el resto del documento:**
- **versión-a** = linaje A → mejor|archive = `(1).zip` (el más completo del linaje A)
- **versión-b** = linaje B = `(3).zip`
- La `(2).zip` es una variante menor de A; su única aporte real es la carrocería `mono`.

### Tecnología (idéntica en las 4, así que no hay conflicto de stack)

React 19 + Vite 7 + TypeScript + `@react-three/fiber` 9 + three 0.186 + zustand +
Tailwind 4 + `vite-plugin-singlefile`. Todo generado por código, sin recursos externos.
El build produce **un único `index.html` de ~1,45 MB** con el JS y el CSS inlinados.

### Cómo se ha verificado (no es lectura de código, es ejecución real)

Monté un banco de pruebas headless (Chromium + Playwright + WebGL por software) que:

1. Arranca el juego, navega Menú → Selector → Carrera con clics reales.
2. Captura **todos** los errores y avisos de consola y los errores de página.
3. Inyecta un `window.__probe()` con el estado real de los 6 pilotos y
   `window.__ff(segundos, entrada)` que **adelanta la simulación sin renderizar**, lo que
   permite simular una carrera completa de 3 vueltas en segundos.

Resultados obtenidos (no son suposiciones):

| Prueba | versión-a | versión-b |
|---|---|---|
| `vite build` | OK, 1.452 KB | OK, 1.442 KB |
| `tsc --noEmit` | 0 errores | 0 errores |
| Carrera completa 3 vueltas | termina, sin errores | termina, sin errores |
| Modos de vehículo usados | land, boat, plane | land, boat, plane |
| Errores de consola | **0** | **0** |

Limitación honesta: en el banco headless el render va por software a ~4–9 fps, así que
**el rendimiento real (60 fps) no se puede medir aquí**. Habrá que comprobarlo en un
navegador de verdad. Lo que sí es válido es la física, porque `dt` está acotado y es
determinista.

---

## 1. Tabla comparativa sistema por sistema

Leyenda: **OK** = funciona · **MEDIO** = funciona a medias · **ROTO** = no funciona ·
**NO** = no existe.

| Sistema | versión-a | versión-b | Mejor |
|---|---|---|---|
| **Conducción** (acelerar, girar, frenar) | **OK** — `A`=izquierda / `D`=derecha medido sobre la tangente de la pista. Aceleración con curvas de velocidad, frenada, `autoGas`, `steerAssist` | **OK** — idéntico (comparten el mismo bloque de física) | Empate |
| **Derrape** | **MEDIO** — funciona, carga la barra de turbo, pero **solo 2 niveles** de mini-turbo (corte 0,3 s / grande 0,85 s) | **MEDIO** — idéntico, 2 niveles | Empate |
| **Turbo** | **OK** — barra que se llena derrapando (0,36/s) y se gasta con turbo manual | **OK** — igual | Empate |
| **Colisiones con paredes** | **OK** — desliza clavando la posición, pierde velocidad poco a poco, `bumpCd` de 0,5 s evita el bucle de vibración. Medido:offset clavado en ±6,1, **0 cambios de signo**, rumbo amortiguado | **OK** — mismo sistema, con `corridorBounds` en vez de `halfWidthAt` | Empate (B marginally más flexible) |
| **Cámara** | **MEDIO** — sigue al vehículo con `lerp`, FOV dinámico con velocidad y temblor. **No tiene en cuenta la altura**: en avión la cámara sube y baja con `y` pero sin anticipar subidas | **MEDIO** — igual. **Peor**: al plegar el submarino dentro de `boat`, la cámara de submarino se perdió (ya no hay `mode === "sub"`) | a |
| **IA de rivales** | **OK** — persigue un punto de mira en la pista, entrelaza, goma elástica según `mode.rubberband`, usa objetos | **OK** — igual, y además reparte monedas de cebo por las ramas alternativas | b (ligeramente) |
| **Objetos** | **OK** — 8 objetos con peso, projectile pool, minas, charcos, rayos | **OK** — los mismos 8 | Empate |
| **Transformaciones** (coche/barco/avión/sub) | **OK** — 4 modos. `sub` es un `VehicleMode` propio con cámara y burbujas propias | **OK** — 4 modos, pero `sub` es un `waterCraft` dentro de `boat`: menos código, pero la cámara y la estela de submarino se perdieron | a |
| **Fusión con torreta** | **MEDIO** — la tecla fusiona, la torreta dispara sola cada 1,15 s, barra de vida en el HUD. **Le falta**: alternar conductor/tirador con la tecla de cambio, la vida no baja al recibir daño, no hay reaparición paralizada de 3 s, los rivales no fusionan | **MEDIO** — igual de incompleto | Empate |
| **Pistas y rutas alternativas** | **MEDIO** — 14 pistas, bifurcaciones que ensanchan la calzada y **puertas de atajo** que teletransportan por un arco volado | **MEDIO** — 8 pistas, pero las rutas son **ramas de verdad**: `branches` con `corridorBounds(min,max)` y cintas de calzada reales que se peeled a un lado, con monedas de cebo | **b** (rumbo) / a (nº de pistas) |
| **Personajes** | **OK** — 16, formas de gota/burbuja/hoja/cristal/holo/nube/estrella/llama, material `meshPhysicalMaterial` con clearcoat e iridiscencia | **OK** — 20 (4 más: cobalt, kiwi, magma + stat) | b |
| **Garaje** | **MEDIO** — 11 carrocerías, 5 ruedas, 3 alerones, 3 propulsores, 3 barcos, 3 aviones, 3 submarinos, colores de carrocería y calcomanía. **Sin acabados** (vidrio/cromo/translúcido/mate) | **MEDIO** — 9 carrocerías, 5 ruedas, 3 alerones, 3 propulsores, **4 Traumaticos** (ski/pontoon/hydro/sub con velocidad y agarre) y **4 aéreos** (wing/heli/glider/rocket) | Empate, con b mejor enTables de Tables |
| **Menús** | **OK** — inicio, selector con 7 pestañas, pausa, resultados, récords, cómo jugar, reinicio instantáneo | **OK** — igual, y además **el estilo de la interfaz cambia con la estética** (`ui: "glass" \| "y2k" \| "win98"`), que es justo el escritorio Windows 98 que pides | **b** |
| **HUD y minimapa** | **OK** — posición, vuelta, tiempo, monedas, anillos, objeto, turbo, vida de fusión, standings, velocímetro, minimapa rotatorio | **OK** — lo mismo | Empate |
| **Idiomas** | **OK** — 8: es, en, fr, ru, ja, zh, he, ar (árabe y hebreo con `dir="rtl"` automático) | **OK** — los mismos 8 | Empate |
| **Táctil** | **MEDIO** — botones en pantalla para dirección,gas, objeto, cambio, fusión, turbo y derrape, con `setTouch` | **MEDIO** — idéntico (mismo `HUD.tsx` con 8 líneas de diferencia) | Empate |
| **Sonido** | **MEDIO** — 82 líneas: beepos sintetizados con WebAudio para turbo, golpe, moneda, objeto, cambio, cuenta atrás. Sin música | **MEDIO** — idéntico | Empate |
| **Rendimiento** | **MEDIO** — bloom configurable, `dpr` limitado, geometrías instanciadas. **No medible aquí** | **MEDIO** — igual | Empate |
| **Organización del código** | **MEDIO** — `Scene.tsx` de 1.284 líneas con física, cámara, IA, objetos y fusión en el mismo `useFrame`. `data.ts` mezcla datos con funciones deUtility | **MEDIO** — `Scene.tsx` de 1.258 líneas, mismaarchitectura. Pero `trackCurve.ts` está mejor partido en primitivas (`corridorBounds`, `branchCenterAt`) | b (ligeramente) |

### Lo que **ninguna** de las dos tiene (y hay que construir)

Esto es el grueso del trabajo de las fases 2–4:

1. **Gravedad y saltos.** No hay `gravity` en ninguna parte: la altura `y` se asigna por zona
   (`Math.sin(u*PI) * SKY_ALTITUDE` en los cielos) y el vehículo se pega a `y=0` en tierra.
   No hay rampas, ni saltos, ni caída, ni reaparición.
2. **Altura real.** Todas las coordenadas `y` de las pistas son **0**. No hay niveles
   apilados, ni puentes, ni túneles de verdad, ni torres, ni espirales.
3. **3 niveles de mini-turbo** (hay 2).
4. **Controles reasignables de verdad** (hay 2 esquemas fijos A/B).
5. **Sin emojis en la interfaz**: hay banderas de idioma (`🇪🇸🇬🇧🇮🇱🇯🇵🇨🇳🇸🇦🇫🇷🇷🇺`), `♪`, `⚑`, `⚙`, `➰`, `❖`, `☰`, `⇄`, `◕`, `❚❚`, `⭐`, `⚡`.
6. **Fusión completa**: alternancia conductor/tirador, vida que baja, separación con
   parálisis de 3 s al vaciarse, rivales que también fusionan.
7. **14+ objetos** (hay 8 en a; b tiene 8).
8. **Acabados** de vehículo (vidrio, cromo, translúcido, mate).
9. **8 pistas largas de 60–90 s** (las actuales son cortas), con 2–3 rutas por altura,
   elementos vivos y mutación entre vueltas.
10. **Modos**: falta Gran Premio por copas, contrarreloj con fantasma, batalla en arena,
    equipos con fusión y eliminación. Hay 5–6 modos simples.

---

## 2. Decisión de base

### Base elegida: **versión-a = `frutiger-aero-3d-racer (1).zip`**

Motivos:

1. **Conducción.** Es la que mejor-aged el Xiang. Las dos linajes comparten el mismo
   bloque de física, pero **a mantiene `sub` como `VehicleMode` propio**, lo que conserva la
   cámara y la estela de submarino que **b perdió** al unificar `waterCraft`. Dado que
   pides "submarino que baja a profundidad real", perder ese código sería tirar trabajo.
2. **Código más ordenado.** `Scene.tsx` va en 1.387 líneas pero separa bien las funciones
   (`updateRacer`, `fireWeapon`, `updateCamera`, `applyHit`), y los datos viven en tablas
   separadas de la lógica, que es justo lo que pides para la fase 4.
3. **Contenido.** 14 pistas frente a 8, y 4 trackers de ruta más por pista.
4. **Interfaz.** Hereda la misma UI de cristal, con `ui: glass/y2k/win98`… salvo que eso
   solo está en b. → **se trae de b.**

### Piezas concretas que se traen de la versión-b

| # | Pieza de b | Dónde va en a | Por qué |
|---|---|---|---|
| 1 | `corridorBounds(t) → {min,max,branch}` | `trackCurve.ts`, sustituyendo a `halfWidthAt` | Permite límites laterales **asimétricos**: base de una calzada y sin base de la otra, que es lo que pide "rutas separadas por altura". |
| 2 | `branchCenterAt(t)` + `Branch {t0,t1,pull}` | `trackCurve.ts` + `TrackDef` | Centro de la cinta alternativa. Permite **tres rutas a distintas alturas** en lugar de una calzada ensanchada. |
| 3 | `BranchRibbons` de `Track.tsx` | `Track.tsx` | Geometría real de la ruta alternativa, con su propia calzada. |
| 4 | Monedas de cebo por rama | `Scene.tsx` (`coinSpots`) | Invita a usar la ruta alta. |
| 5 | `WATER_CRAFTS` / `AIR_CRAFTS` con `speed` y `handling` | `data.ts` | Tabla de datos con 4 barcos y 4 aviones **con estadísticas propias**, que es lo que pide el garaje. Se ** fusiona** con los `BoatId/PlaneId/SubId` de a, sin duplicar el modelo. |
| 6 | `ui: "glass" \| "y2k" \| "win98"` por estética | `data.ts` + `index.css` | Da el escritorio retro Windows 98 y el Y2K reales. |
| 7 | 4 personajes extra (`cobalt`, `kiwi`, `magma`, …) | `data.ts` | Pistas para llegar a 12 originales sin inventar de cero (los 16 de a + los 4 de b = 20). |
| 8 | Modo `endurance` (8 vueltas) | `data.ts` | Base para el Gran Premio por copas. |
| 9 | `SubFish` de `Track.tsx` | `Track.tsx` | Criaturas que nadan en la zona de submarino. |
| 10 | `Models.tsx` reescrito de `a1` (hoja de rollers) | `game/Models.tsx` | La versión de b es más compacta; **no** se trae, se queda la de a. |

**Lo que NO se trae de b** (y por qué): su `Scene.tsx` completo (reemplazaría la física que
ya funciona), sus `trackCurve.ts` a secas (pierde los atajos), su `Models.tsx` (peor
detallado), su `index.css`/`HUD.tsx`/`Minimap.tsx` (equivalentes, y 바꾸irlos rompe a los
datos) y su `timeBonus` con `75000` fijo (bug: ignora las vueltas del modo; se conserva el
`mode.laps * 55000` de a).

**Regla de mezcla:** un solo motor (el de a) y un solo sistema por concepto. Si b tiene una
versión mejor de algo, se **adapta** a la de a; nunca se ejecuta el código de los dos.

---

## 3. Estado

- [x] **Fase 0 — Auditoría** (este documento)
- [ ] **Fase 1 — Unir**: base `a1` + las 10 piezas de la tabla de arriba
- [ ] **Fase 2 — Arreglos obligatorios**: giro A/D en las 4 formas, pared sin vibración,
      mini-turbo de 3 niveles, controles reasignables, táctiles completos, sin emojis,
      60 fps, carrera limpia
- [ ] **Fase 3 — Pistas verticales**: gravedad, saltos, niveles apilados, espirales, torres,
      puentes, túneles, cañones lanzadores, rutas por altura, reaparición, IA en 3D,
      minimapa por niveles
- [ ] **Fase 4 — Completar**: 8 pistas largas, 8 estéticas, 12 personajes, garaje completo,
      14+ objetos, fusión completa, 6 modos, interfaz, 8 idiomas, sensación

### Lo que tienes que probar tú a mano

Al final de cada fase te daré una lista corta y concreta. De momento, para esta fase:

1. Abre `juego/dist/index.html` (o `npm run dev`) en Chrome y Firefox.
2. Mide fps con el panel de rendimiento o con un medidor externo: **Objetivo 60 fps** en
   escritorio. Avísame si baja de 60 y de qué.
3. En un móvil o con las DevTools en modo táctil, prueba los botones de la pantalla.