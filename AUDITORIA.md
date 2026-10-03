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
| Bahía Aero | Frutiger Aero | 2196 | 0–30 | colina con horquilla, salto, travesía en barco, recta final con carril-rampa |
| Bosque Colgante | Frutiger Eco | 2287 | 8–59 | subida en zigzag, dos saltos en la bajada, tobogán sin barreras desde la cima |
| Arrecife Profundo | Aqua | 2162 | −20–10 | mar abierto, inmersión a 20 bajo el mar, cañón sobre la última curva, carril-rampa sobre el agua |
| Torre Neón | Techno | 2413 | 2–54 | espiral de 2¼ vueltas, vuelo en picado desde la cima, tres carriles a tres alturas en la recta |
| Órbita Y2K | Y2K | 2301 | 8–42 | ocho con una vuelta extra en espiral, puente 22 unidades sobre la recta, carretera encima y debajo del puente |
| Cascada Líquida | Liquid Glass | 2713 | −18–61 | tres caídas de 14–16 unidades, atajo sin barreras y con hueco por dentro de la segunda horquilla, barco, inmersión, cañón de vuelta a la cima |
| Escritorio 98 | Windows 98 | 2242 | 2–20 | esquinas a 90°, salto, portal, recta de tres carriles (uno en túnel) |
| Gran Fusión | mezcla | 2504 | −18–36 | espiral, vuelo, barco, inmersión, cañón y tres carriles a meta |

## 2b. Vida, lectura y rutas (última pasada)

- **La estética cambia dentro de la misma pista.** Cada vuelta atraviesa de 3 a 7 estéticas:
  al cruzar un arco con el nombre de la nueva, cambian el asfalto, las barreras, los adornos,
  el cielo, la niebla y la luz. Gran Fusión pasa por siete.
- **Rutas: de 13 a 20.** Nuevas: carril bajo en túnel en la subida de Bahía, interior de la
  primera horquilla de Bosque y de Cascada (sin barreras), segundo carril sobre el mar en
  Arrecife, túnel bajo el puente en la recta de Órbita. Cada ruta lleva su color en el
  asfalto, en el cartel de la entrada y en el minimapa: naranja = por arriba, azul = por
  abajo, amarillo = atajo arriesgado sin barreras, verde = carril lateral.
- **Señalización.** Cartel en cada desvío, chevrones en el exterior de cada curva, franja
  amarilla y negra antes de cada salto con el labio iluminado, luces a lo largo de la línea
  de vuelo y cañones marcados en el minimapa con su punto de caída.
- **Tráfico.** De 2 a 4 autobuses lentos por pista en los tramos de carretera normal, por los
  carriles exteriores; chocar con ellos te frena y te aparta.
- **Ambiente.** Nubes, globos, burbujas y gotas ya rodean la pista (antes estaban agrupados
  en el origen, fuera de la vista), y en el mar saltan peces junto a los carriles de barco.

## 2c. La IA y los niveles de dificultad

La IA se reescribió con una regla: **fácil no es torpe**. Los cuatro niveles conducen bien;
lo que cambia es cuánto aprietan y cómo te tratan.

Lo que hacen todos los niveles:

- toman el interior de la curva y vuelven a su carril en la recta;
- esquivan el tráfico, los pilares móviles, las minas y a los karts más lentos, pasando por
  el lado con más sitio;
- derrapan en las curvas que lo merecen y sueltan el mini-turbo a la salida;
- disparan el turbo en recta, nunca antes de un salto ni donde no hay barreras;
- van a por los pads de turbo;
- usan cada objeto para lo que es: misil, rayo e intercambio solo con alguien delante a
  tiro; gel y mina solo con alguien pegado detrás; el turbo en recta;
- corren en pareja y se fusionan cuando tienen a quién disparar.

Lo que cambia con el nivel (`AI_PROFILES` en `data.ts`):

| | Fácil | Normal | Difícil | Experto |
|---|---|---|---|---|
| Ritmo (velocidad punta) | 90 % | 96 % | 100 % | 105 % |
| Cuánto apura el interior de la curva | 55 % | 70 % | 82 % | 90 % |
| Cuánto aguanta el derrape | 0,5 s (mini-turbo pequeño) | 0,95 s | 1,2 s | 1,4 s |
| Dispara el turbo con la barra al | 100 % | 80 % | 60 % | 45 % |
| Tarda en usar un objeto | 2,2 s | 1,3 s | 0,7 s | 0,4 s |
| Deja en paz al que acaba de recibir | 10 s | 5 s | 1,5 s | 0 s |
| Te espera si vas detrás | 14 % | 8 % | 3 % | 0 % |
| Aprieta si vas delante | 2 % | 7 % | 12 % | 18 % |
| Toma rutas / atajos sin barreras | 35 % / 3 % | 50 % / 12 % | 65 % / 30 % | 75 % / 50 % |
| Tarda en salir | 0,7 s | 0,4 s | 0,15 s | 0 s |
| Titubeos (levanta el pie, nunca volantazo) | 1 cada 20 s | 1 cada 40 s | 1 cada 2 min | nunca |

Medido en Bosque Colgante, 2 vueltas, 5 rivales: en Fácil el líder rueda a 82 s por vuelta y
en Difícil a 71 s; en los dos niveles 0 caídas y entre 1 y 1,6 toques de pared por rival. Los
rivales encadenan entre 7 y 8 mini-turbos en esas dos vueltas.

Bugs que aparecieron al medir y se arreglaron: la IA tomaba las curvas por fuera (signo
invertido), se quedaba dando vueltas al final de una ruta más larga que el tramo que
sustituye, y los chevrones de curva estaban en el interior en vez de en el exterior.

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
| Carrera completa de 3 vueltas en el juego real, jugador en piloto automático + 5 rivales | las 8 pistas llegan a la pantalla de resultados con 0 errores de consola; quedan 0–1 caídas de rivales por carrera, en saltos |
| Pared, en el juego real | raspando la barrera la posición lateral varía 0,1 unidades, la dirección no oscila y la velocidad se mantiene (medido en la primera pista de prueba) |
| Juego real en navegador sin GPU, 6 karts | en las 8 pistas el primer rival completa la vuelta en 74–95 s; se visitan tierra, barco, avión y submarino donde tocan; la IA usa las rutas; 0 errores de consola |

**Lo que no se puede medir aquí**: los 60 fps y la sensación de conducción. El navegador de
pruebas renderiza por software.

## 3b. Bugs arreglados en la última pasada

Encontrados corriendo carreras completas de 3 vueltas en el juego real:

- **La IA daba vueltas en círculo** al tomar una ruta más corta o más larga que el tramo
  que sustituye (el atajo de Cascada bloqueaba a toda la parrilla): el punto al que apuntaba
  se calculaba con el progreso de vuelta, que no vale dentro de una ruta. Ahora se mide en
  metros sobre la propia ruta.
- **Caídas en bucle**: un rival lento reaparecía antes de un hueco sin velocidad para pasarlo
  y volvía a caer sin fin. Ahora reaparece más rápido y con más carrerilla, y si cae dos
  veces seguidas se le deja pasado el obstáculo.
- **Saltos imposibles para los personajes lentos**: los huecos de la carretera principal
  pasan de 15–16 a 11–12 unidades y el labio es más alto; los de las rutas arriesgadas
  siguen siendo largos.
- **Los pads solo se activaban pisando el centro**: ahora valen en todo su ancho pintado.
- **Reasignar teclas no liberaba las de fábrica** (flechas y WASD seguían activas siempre).
- **Reasignar un botón táctil hacía dos acciones a la vez**.
- **El turbo no tenía botón táctil**: ahora es un hueco táctil más, reasignable.
- **Cajas y monedas flotando sobre huecos, cañones o el mar**: las cajas van en filas de
  tres solo sobre carretera real; las monedas se omiten sobre los huecos.
- **El reparto de objetos ignoraba la posición**: el último recibe sobre todo misil, rayo,
  intercambio y terremoto; el líder, escudo, gel y mina.
- **Los niveles de IA no cambiaban el ritmo**: `pace` y `accel` ahora se aplican.
- **El contador de peligros por vuelta no se reiniciaba** entre carreras.
- **Emojis en la interfaz**: las banderas son ahora códigos de idioma y se quitaron ⭐ y ⚡.
- Flechas pintadas en la entrada de cada ruta alternativa.

## 4. Lo que sigue roto o falta

Del plan original, sin hacer todavía:

- **Mutación de la pista entre vueltas**: cambian paleta y luz, y cada vuelta del líder
  enciende dos pilares móviles más en tramos de carretera normal. No hay caminos que se abran
  o cierren ni agua que suba.
- **Elementos vivos**: hay tráfico, pilares móviles, peces que saltan y un portal; no hay
  plataformas móviles ni criaturas que crucen la carretera.
- **Rutas ramificadas**: todas las rutas salen de la carretera principal y vuelven a ella.
  No hay rutas que se bifurquen a su vez; el motor no lo admite todavía.
- **IA**: no cambia de personaje en carrera (el relevo es solo del jugador) y no apunta la torreta: dispara al rival de delante.
- **Objetos**: 12 (el plan pide 14).
- **Fusión**: los rivales ya se fusionan; sigue sin alternar conductor/artillero y sin torreta de 360°.
- **Modos**: no hay Gran Premio, fantasma de contrarreloj, arena, equipos ni eliminación.
- **Garaje**: 19 carrocerías en la tabla (el tipo declara 24).
- **Decorado**: cada pista tiene el adorno de su estética (palmeras, árboles, ventanas de
  Windows, esferas cromadas…) sobre un suelo cuadriculado o sobre islotes en el mar, arcos en
  los carriles en túnel y obstáculos colgados en los tramos de vuelo. Sigue sin haber relieve
  ni edificios grandes propios de cada mundo.
- **Tiempos de vuelta**: Cascada ronda 94 s a velocidad base, algo por encima del objetivo
  de 60–90 s si no se usan los turbos. Las demás quedan entre 75 y 87 s.

## 5. Lo que tienes que probar tú

1. `cd juego && npm run build` y abrir `juego/dist/index.html` en Chrome y Firefox.
2. Fps en escritorio y móvil: objetivo 60.
3. En cada pista: que las paredes no vibren, que los saltos se pasen a velocidad normal y
   que al caer reaparezcas antes del salto.
4. Torre Neón y Gran Fusión: en el tramo de avión, acelerar sube y frenar baja; hay que
   pasar por los anillos.
5. Arrecife, Cascada y Gran Fusión: el cañón te lanza sin poder esquivarlo y aterrizas bien.
6. Órbita Y2K: pasar por debajo del puente y luego por encima; el minimapa debe mostrar el cruce.
