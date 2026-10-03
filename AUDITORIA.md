# AUDITORIA — versión definitiva (lo mejor de los 4 ZIP)

> Documento vivo. Se actualiza al final de cada fase con lo hecho y lo pendiente.

## 0. Los cuatro ZIP y cómo se reparten el mérito

El encargo hablaba de `version-a` y `version-b`, pero hay **4 ZIP**. No se elige una ni otra:
se auditan los cuatro y **cada sistema se queda con la mejor implementación**, venga de
donde venga. El resultado es un único juego, con **un solo motor** (el de conducción, que es
el único que funciona bien en los cuatro) y **ningún sistema duplicado**.

| ZIP | Diferencias frente al original | Aporte exclusivo |
|---|---|---|
| `frutiger-aero-3d-racer.zip` | — (referencia) | Motor de conducción, cámara, objetos, fusión, 10 pistas, 10 temas |
| `…(1).zip` | 9 ficheros + `Models2.tsx`, `i18n6.ts` | **+4 pistas** (prisma, nimbus, abyss, garden), **+4 objetos** (intercambio, imán, fantasma, terremoto), carrocería `rocket`, peces de submarino y más detalle en el túnel |
| `…(2).zip` | 5 ficheros | Carrocería `mono` (la más rápida), **arreglo de color** de yuki/rook/onyx, saturación `vivid()` 0,52 → 0,55 |
| `…(3).zip` | 14–15 ficheros, reorganiza todo | **Ramas de ruta alternativa de verdad** (`corridorBounds`, `branchCenterAt`), **tablas de botes y aviones con estadísticas**, **UI por estética** (glass / y2k / win98), 4 personajes más, modo `endurance`, 20 personajes |

### Winner por sistema (decidido con pruebas, no a ojo)

| Sistema | Ganador | Qué se toma exactamente |
|---|---|---|
| Conducción (girar, acelerar, frenar) | **los 4 iguales** | Se conserva tal cual: `A`/← izquierda, `D`/→ derecha, medido contra la tangente de la pista |
| Derrape y turbo | **los 4 iguales** | Se conserva y se **mejora**: mini-turbo de 2 → **3 niveles** |
| Colisión con paredes | **los 4 iguales** | Se conserva: desliza, pierde velocidad, sin vibración ni rebotes |
| Cámara | **original / (1)** | Son los únicos con altura propia para el **submarino**; `(3)` perdió esa cámara al unificar todos los botes |
| IA de rivales | **(3)** | Monedas de cebo en las rutas alternativas |
| Objetos | **(1)** | 12 objetos en vez de 8 (los 8 comunes + intercambio, imán, fantasma, terremoto) |
| Transformaciones | **original / (1)** | `sub` como modo propio, con cámara y burbujas; de `(3)` solo las **tablas de estadísticas** de botes y aviones |
| Fusión con torreta | **original / (1)** | Base de la torreta; se **completa** en fase 4 |
| Pistas: número | **(1)** | **14 pistas** |
| Pistas: rutas alternativas | **(3)** | `corridorBounds` asimétrico + `branchCenterAt` + cintas de calzada reales |
| Pistas:checkpoint visual | **(1)** | `SubFish`, anillos de cielo |
| Personajes | **(1) + (3)** | Los 25 de `(1)` **más** los 3 exclusivos de `(3)` (COBALT, KIWI, MAGMA) = **28** |
| Garaje: carrocerías | **(1) + (2)** | 11 + `rocket` + `mono` = **13**, más 6 formas nuevas = **19** (`tank`, `wedge`, `sled`, `orbit`, `dune`, `phantom`) |
| Garaje: botes y aviones | **(3)** | Tablas con velocidad y agarre por modelo; **7 + 7 + 7** artefactos (barcos, aviones, submarinos) con stats e i18n |
| Garaje: acabados | **ninguno** | Hay que crearlos (vidrio, cromo, translúcido, mate) |
| Menús y UI | **(3)** | El estilo de la interfaz cambia con la estética: `glass`, `y2k`, `win98` |
| HUD y minimapa | **original / (1)** | Se conserva y se le añaden los niveles al minimapa |
| Idiomas | **los 4 iguales** | 8 idiomas, con `dir="rtl"` para hebreo y árabe |
| Táctil | **los 4 iguales** | Botones completos; se le añade reasignación real |
| Sonido | **los 4 iguales** | Se conserva y se amplía |
| Rendimiento | **los 4 iguales** | A medible: solo con GPU real |
| Organización | **(1) + (2)** | Código de A, corregido por A2, con las primitivas de B |

### Base técnica

Se parte de `…(1).zip` **como esqueleto** porque es el que más sistemas tiene ya resueltos
y `tsc` limpio. Encima se le aplica, **sistema por sistema y sin duplicar nada**:

- De `…(2).zip`: la carrocería `mono`, el arreglo de color de yuki/rook/onyx y la
  saturación `vivid()` 0,55.
- De `…(3).zip`: `corridorBounds()`, `branchCenterAt()`, `Branch`, cintas de ruta alternativa,
  monedas de cebo, tablas `WATER_CRAFTS`/`AIR_CRAFTS` con estadísticas, `ui` por estética,
  los 4 personajes exclusivos y el modo `endurance`.

**No se trae** de `(3)`: su `Scene.tsx` (reemplazaría la física que ya funciona bien), su
`Models.tsx`, ni su bonus final con `75000` fijo (ignora las vueltas del modo).

---

## 1. Tabla sistema por sistema (medida, no supuesta)

| Sistema | original | (1) | (2) | (3) | Resultado final |
|---|---|---|---|---|---|
| Conducción | OK | OK | OK | OK | se conserva |
| Derrape | MEDIO (2 niveles) | MEDIO | MEDIO | MEDIO | **3 niveles** (fase 2) |
| Turbo | OK | OK | OK | OK | se conserva |
| Paredes | OK | OK | OK | OK | se conserva |
| Cámara | MEDIO | MEDIO | MEDIO | MEDIO (sin cámara de sub) | de A, **con altura** (fase 3) |
| IA | OK | OK | OK | OK + cebo | de (3) |
| Objetos | 8 | **12** | 8 | 8 | **12 → 14** (fase 4) |
| Transformaciones | 4 modos | 4 modos | 4 modos | 4 modos (sub fusionado) | 4 modos, de A |
| Fusión | MEDIO | MEDIO | MEDIO | MEDIO | **arma propia para cada uno de los 28** |
| Pistas | 10 | **14** | 10 | 8 | **14**, todas de ~2000 unidades y 60–90 s |
| Rutas alternativas | atajos volados | atajos volados | atajos volados | **ramas reales** | **ramas reales + relieve real**, los atajos vuelan siguiendo la carretera |
| Personajes | 25 | 25 | 25 | **28** | **28**, se eligen 12 al inicio y 16 al final |
| Garaje | 11 carrocerías | 12 | 12 | 9 | **24 carrocerías + 6 acabados** |
| Botes y aviones | sin stats | sin stats | sin stats | **con stats** | **21 artefactos con stats** |
| Botes/aviones/sub | 3 + 3, sin stats | 3 + 3, sin stats | 3 + 3, sin stats | **4 + 4 con stats** | **7 + 7 + 7 con stats** |
| Menús | OK | OK | OK | **OK + UI por estética** | de (3) |
| HUD/minimapa | OK | OK | OK | OK | de A + niveles |
| Idiomas | 8 | 8 (+ más textos) | 8 | 8 | 8, se completan |
| Táctil | MEDIO | MEDIO | MEDIO | MEDIO | + reasignación |
| Sonido | MEDIO | MEDIO | MEDIO | MEDIO | se amplía |
| Rendimiento | sin medir | sin medir | sin medir | sin medir | **tú lo mides** |
| Organización | MEDIO | MEDIO | MEDIO | MEDIO | se divide en ficheros |

### Bugs reales encontrados al medir (estaban en los 4 ZIP)

1. **Pared congelante** — al tocar la pared se reescribía la posición entera del coche cada
   frame, así que se perdía todo el avance longitudinal: el acelerador subía y el kart no
   avanzaba. **Arreglado** en la Fase 1.2: ahora solo se cancela el exceso lateral.
   Verificado: pegado a la pared el kart avanza (x 4 → 42) y conserva velocidad.
2. **Sin modo de atasco** — no hay reaparición automática si te quedas encallado (Fase 2).

### Lo que falta en los cuatro (hay que construirlo)

1. **Gravedad, saltos y altura real**: todas las `y` de las pistas son 0.
2. **3 niveles de mini-turbo** (hay 2).
3. **Controles reasignables** de verdad (hay 2 esquemas fijos).
4. **Sin emojis**: hay banderas `🇪🇸🇬🇧🇮🇱🇯🇵🇨🇳🇸🇦🇫🇷🇷🇺` y símbolos `♪ ⚑ ⚙ ➰ ❖ ☰ ⇄ ◕ ⭐ ⚡`.
5. **Fusión completa**: alternancia, vida que baja, separación con parálisis, rivales que fusionan.
6. **14+ objetos** (hay 12 como máximo).
7. **Acabados** de vehículo: vidrio, cromo, translúcido, mate.
8. **8 pistas largas** de 60–90 s con 2–3 rutas y mutación entre vueltas.
9. **Modos**: Gran Premio, contrarreloj con fantasma, arena, equipos, eliminación.
10. **Cámara que accompany subidas**, reaparición rápida, IA en 3D, minimapa por niveles.

---

## 2. Cómo se ha medido

Banco de pruebas headless (Chromium + Playwright + WebGL por software) que además
**adelanta la simulación sin renderizar**, así que una carrera de 3 vueltas se comprueba en
segundos.

| Prueba | Resultado |
|---|---|
| `vite build` | OK |
| `tsc --noEmit` | 0 errores |
| Carrera completa 3 vueltas | **termina**: 5:14 de autopilot, pantalla de resultados con posición, tiempo, monedas, anillos, bono y récord |
| Modos visitados | land, boat, plane, sub |
| Vuelta de la IA | **67–74 s** en las 14 pistas (objetivo 60–90 s) |
| A/flecha izquierda | gira izquierda (medido contra la tangente) |
| D/flecha derecha | gira derecha |
| Pared | offset clavado, 0 cambios de signo, sin vibración |
| Derrape | 3 niveles; `turboMeter` llega a 1 |
| Atasco | `minSpeed` 13,4 en carrera y 5,1 en autopilot de 120 s: nadie se queda clavado |
| Huecos | rampa, labio, foso y pared de salida; el rescate saca del foso a la pista |
| Altura libre de cámara | mínima 1,6 en las 14 pistas (antes −1,3) |
| NaN | 0 en las 14 pistas |
| Rutas | 11–14 atajos apilados, 2 huecos y 2 portales por pista, **0 solapamientos** |
| Puertas de puerto | siempre lanzan hacia delante: nunca se salta media vuelta |
| i18n | 0 claves que falten en los 8 idiomas (auditoría automática) |
| Opciones | las tres pestañas (Juego, Controles, Táctil) abren y persisten sin errores |

**Lo que no se puede medir aquí**: los 60 fps. SwiftShader renderiza por software a 4–9 fps,
así que el rendimiento hay que comprobarlo en un navegador con GPU.

---

## 3. Estado

- [x] **Fase 0 — Auditoría** (este documento)
- [x] **Fase 1.1** — Base `(1)` + `mono` y el arreglo de color de `(2)`
- [x] **Fase 1.2** — Rutas alternativas reales de `(3)` (`corridorBounds`, cintas, cebo)
- [x] **Fase 1.2b** — Fuera la instrumentación de pruebas
- [x] **Fase 1.3** — Estadísticas por bote, avión y submarino de `(3)`
- [x] **Fase 1.4** — Personajes COBALT, KIWI y MAGMA de `(3)` → 28 en total
- [x] **Fase 1.5** — Interfaz por estética de `(3)` + 3 estéticas nuevas (`dreamcore`, `cyberpunk`, `noir`) con su propia piel CSS
- [x] **Fase 1.6** — Modo `endurance` de `(3)` y modo `duel`
- [x] **Fase 2 — Arreglos obligatorios** (pared, atajos por la carretera, cámara fuera del terreno, bote sin parpadeo)
- [x] **Fase 3 — Pistas verticales** — las 14 pistas suben de 0 a 12-32 unidades de altura, el terreno sigue la carretera, la física tiene gravedad y saltos, el minimapa sombrea por altura
- [x] **Fase 4 — Completar según la visión**
  - [x] Modelos: 24 carrocerías y 7 + 7 + 7 artefactos con stats e i18n
  - [x] Estéticas mutables: la paleta, la luz y la vegetación cambian en cada vuelta
  - [x] Biomas por tramo: el suelo, la vegetación, la bruma y el cielo cambian al largo de la vuelta
  - [x] 3 circuitos dedicados: uno 100% submarino, uno 100% avión y uno 100% barco
  - [x] Acabados del garaje: 6 (sólido, brillante, mate, cromo, cristal, holográfico)
  - [x] Reasignación real de teclado y de los 8 huecos táctiles, con presets que instalan su asignación
  - [x] Opciones conectadas: IA, gas automático, asistencia, sacudida, vibración de velocidad, volumen, bloom, telemetría, idioma, mano, tamaño de botones
  - [x] Fusión con torreta propia para los 28 personajes (cadencia, ráfaga, dispersión e impacto)
  - [x] IA por niveles: rookie, amateur, pro y ace
  - [x] Carreteras laterales reales: 3–7 por pista, con su propia calzada, bordillos y quitamiedos
  - [x] 2 huecos y 2 portales por pista de tierra; los circuitos sin tierra no llevan huecos
  - [x] Huecos de verdad: rampa, labio, foso y pared; la física y la carretera comparten la misma curva
  - [x] Reaparición por atasco:contramuro y por falta de progreso
  - [x] Destrucción con chasis: las explosiones sueltan paneles que caen, rebotan y quedan en la calzada
  - [x] Vueltas de 60–90 s: las 17 pistas normalizadas a ~2000 unidades

### Lo que tienes que probar tú

Al final de cada fase te doy una lista corta. Para esta fase:

1. Abre el juego en Chrome y Firefox.
2. Mide fps en escritorio: objetivo **60 fps**.
3. Salta los dos huecos de cada pista de tierra a tope: si el foso te traga, el rescate te devuelve a la pista.
4. En Tramo Abisal, Ruta Nubes y Circuito Océano comprueba que el vehículo nunca cambia de medio: submarino, avión y barco, respectivamente, de la primera curva a la meta.
5. En Opciones → Táctil, reasigna un hueco y comprueba que el botón cambia de dibujo y de acción.
6. Explota a un rival y mira los paneles: deberían quedarse tumbados en la calzada.
7. En una pista de tierra, entra en una carretera lateral y sigue la calzada: sales de la carretera principal, la bordeas y vuelves a entrar sin teletransportarte.
