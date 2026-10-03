# AUDITORIA — estado real del juego

> Documento vivo. Se actualiza al final de cada fase con lo hecho y lo pendiente.
> La versión anterior de este documento describía el juego unido a partir de los cuatro ZIP;
> varias de sus afirmaciones no se cumplían en el código (paredes sin vibración, huecos que
> se saltaban, IA que usaba las rutas, 24 carrocerías). Esta versión solo dice lo medido.

## 1. Qué se rehízo desde cero (rama `pistas-3d`)

| Sistema | Antes | Ahora |
|---|---|---|
| Modelo de pista | una línea central 2D; la altura era una suma de senos y ninguna pista se cruzaba consigo misma | cintas de carretera en 3D real (`trackCurve.ts`): la principal y las rutas, que pueden pasar por encima y por debajo unas de otras |
| Suelo | "punto más cercano de la curva" | `groundAt()`: de las carreteras que hay bajo un punto, la más cercana en altura. Un puente y la carretera de debajo son pisos distintos |
| Paredes | tope al desplazamiento lateral, con un salto de 1,1 unidades al rozar | `physics.ts`: se desliza; el golpe cuesta según el ángulo (roce ≈ nada, frontal ≈ 70 %). La barrera solo se dibuja donde la física tiene pared |
| Saltos | fosos de 100 unidades imposibles de saltar | un hueco es carretera que no existe, con labio que lanza. Si no llegas, caes y reapareces antes del salto con carrerilla |
| Karts entre sí | se atravesaban | se empujan; el `weight` del personaje decide quién cede |
| Cuestas | solo inclinaban el modelo | quitan velocidad al subir y la dan al bajar |
| Vueltas | cruzar la meta, retroceder y volver sumaba otra | se cuentan por distancia realmente recorrida |
| Rutas alternativas | un abombamiento lateral de la misma curva; la IA no las tomaba | carreteras con forma propia a otra altura; la IA decide en cada cruce y las sigue |
| Avión | arco fijo de 9 unidades | la línea de vuelo sube y baja con la pista y el piloto asciende o desciende con acelerar/frenar para pasar por los anillos |
| Submarino | pegado a la carretera, sin profundidad | el tubo baja hasta 18–20 unidades bajo el nivel del mar |
| Cañones | no existían | lanzan el vehículo en arco a otro punto de la pista |
| Minimapa | sombreado por altura | dibuja los tramos de abajo arriba, así un puente se ve cruzar por encima |
| Sombras | solo en el centro del mapa | el sol sigue al jugador |
| Paso de simulación | un fotograma lento = cámara lenta | pasos de 1/60 s como máximo; un fotograma lento se parte en varios pasos |
| Pistas | 17 generadas con la misma fórmula | 8 dibujadas a mano, una por estética (`tracks.ts`) |

Se quitaron: las 17 pistas generadas, los fosos, y los generadores de carreteras laterales,
bifurcaciones y portales.

## 2. Las 8 pistas

Dibujadas con el diseñador de `trackDesign.ts` (recta, curva, espiral, caída, desvío).
Longitud en unidades; un kart recorre unas 27 por segundo sin turbo.

| Pista | Estética | Largo | Alturas | Qué tiene |
|---|---|---|---|---|
| Bahía Aero | Frutiger Aero | 2515 | 0–30 | colina con horquilla, salto, travesía en barco, recta final con carril-rampa |
| Bosque Colgante | Frutiger Eco | 2287 | 8–59 | subida en zigzag, dos saltos en la bajada, tobogán sin barreras desde la cima |
| Arrecife Profundo | Aqua | 2162 | −20–10 | mar abierto, inmersión a 20 bajo el mar, cañón sobre la última curva, carril-rampa sobre el agua |
| Torre Neón | Techno | 2413 | 2–54 | espiral de 2¼ vueltas, vuelo en picado desde la cima, tres carriles a tres alturas en la recta |
| Órbita Y2K | Y2K | 2301 | 8–42 | ocho con una vuelta extra en espiral, puente 22 unidades sobre la recta, carretera encima y debajo del puente |
| Cascada Líquida | Liquid Glass | 2713 | −18–61 | tres caídas de 14–16 unidades, atajo sin barreras y con hueco por dentro de la segunda horquilla, barco, inmersión, cañón de vuelta a la cima |
| Escritorio 98 | Windows 98 | 2242 | 2–20 | esquinas a 90°, salto, portal, recta de tres carriles (uno en túnel) |
| Gran Fusión | mezcla | 2683 | −18–36 | espiral, vuelo, barco, inmersión, cañón y tres carriles a meta |

## 3. Cómo se mide

Tres herramientas en `juego/tools/`:

- `sim.sh check` — geometría de cada pista: error de cierre, radio mínimo, pendiente máxima y
  altura libre donde una carretera pasa sobre otra.
- `sim.sh` — conduce un cuerpo dos vueltas por cada pista, con y sin rutas, con la misma
  física que el juego y sin gráficos.
- `plot.py` — plano cenital de cada pista coloreado por altura.

| Prueba | Resultado |
|---|---|
| `tsc --noEmit` | 0 errores |
| `vite build` | OK |
| `sim.sh check` | las 8 cierran con error ≤ 7 unidades; radios y alturas libres dentro de límites. Único aviso: 64 % de pendiente en Cascada, que son las caídas |
| `sim.sh` (16 recorridos) | 16 completos, 0 caídas, vueltas de 75 a 94 s a velocidad base sin turbos |
| Pared, en el juego real | raspando la barrera la posición lateral varía 0,1 unidades, la dirección no oscila y la velocidad se mantiene (medido en la primera pista de prueba) |
| Juego real en navegador sin GPU, 6 karts | en las 8 pistas el primer rival completa la vuelta en 74–95 s; se visitan tierra, barco, avión y submarino donde tocan; la IA usa las rutas; 0 errores de consola |

**Lo que no se puede medir aquí**: los 60 fps y la sensación de conducción. El navegador de
pruebas renderiza por software.

## 4. Lo que sigue roto o falta

Del plan original, sin hacer todavía:

- **Mutación de la pista entre vueltas**: cambian paleta y luz, y cada vuelta del líder
  enciende dos pilares móviles más en tramos de carretera normal. No hay caminos que se abran
  o cierren ni agua que suba.
- **Elementos vivos**: quedan los pilares móviles y un portal; no hay tráfico, criaturas ni
  plataformas móviles.
- **Controles**: reasignar teclas no quita flechas/WASD; reasignar botones táctiles hace doble
  acción; el turbo no tiene botón táctil.
- **IA**: no derrapa, no usa turbo ni fusión; `pace`, `accel` y `drift` de los niveles casi no
  se usan.
- **Objetos**: 12 (el plan pide 14) y el reparto no depende de la posición.
- **Fusión**: solo el jugador, sin alternar conductor/artillero, sin torreta de 360°.
- **Modos**: no hay Gran Premio, fantasma de contrarreloj, arena, equipos ni eliminación.
- **Garaje**: 19 carrocerías en la tabla (el tipo declara 24).
- **Emojis y símbolos** en la interfaz (banderas, ⭐ ⚡ ♪).
- **Decorado**: cada pista tiene el adorno de su estética (palmeras, árboles, ventanas de
  Windows, esferas cromadas…) sobre un suelo cuadriculado o sobre islotes en el mar, arcos en
  los carriles en túnel y obstáculos colgados en los tramos de vuelo. Sigue sin haber relieve
  ni edificios grandes propios de cada mundo.
- **Tiempos de vuelta**: Bahía, Cascada y Gran Fusión rondan 90–94 s a velocidad base, algo
  por encima del objetivo de 60–90 s si no se usan los turbos.

## 5. Lo que tienes que probar tú

1. `cd juego && npm run build` y abrir `juego/dist/index.html` en Chrome y Firefox.
2. Fps en escritorio y móvil: objetivo 60.
3. En cada pista: que las paredes no vibren, que los saltos se pasen a velocidad normal y
   que al caer reaparezcas antes del salto.
4. Torre Neón y Gran Fusión: en el tramo de avión, acelerar sube y frenar baja; hay que
   pasar por los anillos.
5. Arrecife, Cascada y Gran Fusión: el cañón te lanza sin poder esquivarlo y aterrizas bien.
6. Órbita Y2K: pasar por debajo del puente y luego por encima; el minimapa debe mostrar el cruce.
