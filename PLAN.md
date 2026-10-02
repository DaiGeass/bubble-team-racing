# PLAN — más modelos, pistas verticales, estética que muta

## 1. Cómo está hecho ahora (estudio previo)

### 1.1 Modelos 3D

```
data.ts (ShapeId / BoatId / PlaneId / SubId + SHAPES/BOATS/PLANES/SUBS + *_STATS)
   ↓
Vehicle.tsx  ──monta SIEMPRE todos los candidatos──  y cada frame decide cuál se ve
   ├── Chassis        (Vehicle.tsx:427)  7 formas terrestres antiguas
   ├── ExtraShapes    (Models.tsx:50)   coupe, van, formula, mono, bubble
   ├── BoatAlt        (Models.tsx:187)  speed, ski      (cat vive en Chassis)
   ├── PlaneAlt       (Models.tsx:259)  bi, delta       (wing vive en Chassis)
   ├── SubModel       (Models.tsx:339)  pod, shark      (classic = fallback)
   └── ModeModels     (Models2.tsx:238) rocket, yacht, stealth, diver
```

Regla de visibilidad (`Vehicle.tsx:647-654`): los modelos antiguos se encienden con
`kind !== "cat"` / `!== "wing"` / `!== "diver"`, y los de `Models2` con `=== "id"`.
**Un id nuevo se enchufa solo**: basta el `if (kind === "nuevo")` en su componente.

Helpers de material ya existentes: `Paint` (metal), `Glass` (cristal), `Neon` (emisivo),
`Underglow` (plano de luz). Primitivas usadas: `box`, `cone`, `sphere` (con cúpula),
`cylinder`, `capsule`, `torus`, `ExtrudeGeometry`.

El garaje (`SelectScreen.tsx:252-369`) es **100 % data-driven**: `SHAPES.map(...)` y
`BOATS/PLANES/SUBS.map(...)`. Añadir ids basta para que aparezcan.

**Cómo se añade un modelo, exactamente:**

| Paso | Archivo | Qué |
|---|---|---|
| 1 | `data.ts` | id en `ShapeId` / `BoatId` / `PlaneId` / `SubId` |
| 2 | `data.ts` | fila en `SHAPES` (con `bonus`) o en `BOATS`/`PLANES`/`SUBS` |
| 3 | `data.ts` | fila en `BOAT_STATS`/`PLANE_STATS`/`SUB_STATS` (**imprescindible**, si no el juego usa 1.0 en silencio) |
| 4 | `Models.tsx` o `Models2.tsx` | la geometría (`if (kind === "x") return (…)`) |
| 5 | `SelectScreen.tsx` | glifo en `SHAPE_GLYPH` (solo formas terrestres) |
| 6 | `i18n7.ts` + `App.tsx` | `shape_x` / `boat_x` / `plane_x` / `sub_x` en 8 idiomas |

Lo que **gratis** con cada modelo nuevo: turbo, escudo, fantasma (hace `traverse()`),
imán, cabeceo, inclinación en curva, pilotín y torreta de fusión.

### 1.2 Pistas

- `TrackDef.points` es un array de `[x, y, z]`, **pero los 14 circuitos tienen `y = 0`**.
- La geometría (`buildRoadGeometry`, `buildBarriers`, `buildRibbon`) ya lee la curva 3D, así
  que **dibujar una pista con altura funciona sin tocar `Track.tsx` en casi nada**.
- Lo que bloquea la verticalidad son **18 sitios** que asumen suelo plano:
  - `Track.tsx` (11): normales `new THREE.Vector3(-tan.z, 0, tan.x)` en líneas 52, 91, 118,
    178, 250, 439, 614, 714, 809, 910, 940.
  - `Scene.tsx` (4): normales en 259, 279, 712, 833.
  - `trackCurve.ts` (3): normales en 126, 154, 169.
- Física: `Scene.tsx:803` `fwd = (sin h, 0, cos h)` sin inclinación; `810-819` **fuerza `r.y`**
  a un valor absoluto según el modo; `1102-1105` escribe `position.set(x, r.y, z)` con solo
  `rotation.y` (sin cabeceo).
- `nearestT` ya funciona en 3D (los `samplePoints` salen de la curva), así que el progreso en
  las subidas se detecta solo.
- Reaparición: hoy solo hay dos casos (cajas y monedas). **No hay reaparición ni detección de
  atasco**: un kart encallado se queda ahí para siempre.
- `TRACK_WIDTH = 14`, `SKY_ALTITUDE = 9`.

### 1.3 Estética

- `ThemeDef` tiene 25 campos (cielos, niebla, agua, suelo, asfalto, barrera, sol, ambiente,
  nubes, islas, glow, partículas, tipo de prop, bloom).
- Casi todo `Track.tsx` lee `theme` **en vivo**, pero `makeRoadTexture(theme)` y
  `buildRoadGeometry()` viven en `useMemo` con dependencia `[theme]`: si `theme` cambia,
  React rehace la geometría. Eso permite mutar estética en caliente **cambiando el objeto
  `theme`**, sin recargar.
- `hazardState.lap` ya existe y el patrón de "el mapa cambia cada vuelta" está probado en
  `MovingHazards`. Es el mismo gancho para mutar la estética.

### 1.4 Bugs encontrados de paso

1. **Faltan claves i18n**: `shape_moto`, `shape_ufo` y `shape_mono` no existen en ningún
   diccionario, así que el garaje muestra el texto literal `shape_mono`.
2. **Listas de la IA desincronizadas**: `Scene.tsx:192` y `195-197` llevan los ids escritos a
   mano, así que `rocket`, `yacht`, `stealth` y `diver` **nunca les toca a los rivales**.
3. **`abyss` tiene las zonas desordenadas** (`data.ts:573`): declara sub, water, sky mientras el
   resto de pistas usan water, sky, sub. Efecto: los aros de cielo se dibujan sobre el agua.

---

## 2. Qué se va a hacer

### Bloque A — modelos (rápido, sin riesgo)
- A1. **6 formas terrestres nuevas** → 19: `tank`, `wedge`, `sled`, `orbit`, `dune`, `phantom`.
- A2. **3 barcos, 3 aviones, 3 submarinos nuevos** → 7 de cada → 21 artefactos.
- A3. **Listas de la IA data-driven** (se acabaron los ids huérfanos).
- A4. **Claves i18n que faltan** y archivo `i18n7.ts` con los textos nuevos en 8 idiomas.

### Bloque B — pistas grandes y verticales
- B1. **Altura del terreno**: `roadYAt(t)` y normal 3D; sustituir las 18 normales horizontales.
- B2. **Conducción sobre el relieve**: `r.y` sigue la superficie + cabeceo + adherencia.
- B3. **Gravedad y saltos**: salir por un borde cae y vuelve a caer sobre la pista.
- B4. **Reaparición y detección de atasco** (el fallo que faltaba).
- B5. **Cámara** que accompany subidas y bajadas; **minimapa** con niveles.
- B6. **Pistas más grandes**: escalar los circuitos para que duren 60–90 s.
- B7. **Más rutas**: 2–3 alternativas por pista + atajos, sobre el sistema de ramas que ya existe.

### Bloque C — estética que muta
- C1. Estética propia por pista (ya se puede: `theme` es un objeto vivo).
- C2. **Mutación entre vueltas** con el gancho `hazardState.lap`, al estilo de los peligros.

Cada bloque se prueba con el banco headless (3 vueltas, 0 errores, dirección correcta,
paredes sin vibración) antes de commitear.