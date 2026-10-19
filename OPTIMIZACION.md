# Rendimiento y compatibilidad gráfica

El mismo frontend se usa en Chromium y en los paquetes de Tauri. Windows utiliza
WebView2; Linux utiliza WebKitGTK. El controlador y el WebView seleccionan el backend
gráfico: el juego no fuerza DirectX, Vulkan, OpenGL ni opciones específicas de AMD,
Intel o NVIDIA.

## Perfiles en Opciones → Juego → Calidad gráfica

| Perfil | Resolución máxima (DPR) | Sombras | Partículas | Antialiasing del contexto |
|---|---:|---:|---:|---|
| Automática (predeterminada) | 1.25, limitada por la pantalla | 1024² | 200 | No |
| Baja | 1, limitada por la pantalla | Desactivadas | 120 | No |
| Equilibrada | 1.25, limitada por la pantalla | 1024² | 200 | No |
| Alta | 1.7, limitada por la pantalla | 2048² | 260 | Sí |

Automática baja la resolución hasta 0.65 tras ventanas sostenidas por encima de
25 ms por cuadro, y la recupera lentamente tras ventanas por debajo de 18 ms.
Estos umbrales son heurísticas, no una garantía de FPS. Excluye el calentamiento,
las pausas, pestañas ocultas y los intervalos aislados de más de 250 ms. No cambia
el paso de la física ni las reglas de red. La preferencia se guarda y las
preferencias antiguas reciben Automática al cargar.

Baja omite bloom y viñeta aunque el interruptor de bloom esté activado y elimina
el desenfoque CSS de los paneles. Los demás perfiles respetan ese interruptor.
El postprocesamiento usa un buffer de 8 bits cuando no está disponible
`EXT_color_buffer_float`, en vez de exigir un buffer flotante al controlador.

La cámara y el snapshot del minimapa reutilizan objetos. Las partículas inactivas
ya no reescriben matrices y no suben colores si no hubo emisiones. El minimapa se
limita a 20 actualizaciones por segundo y el fondo CSS a 10; las transformaciones
3D siguen actualizándose por cuadro.

El perfil release de Rust usa optimización de tamaño `s`, LTO thin, una unidad de
código y elimina los símbolos del binario. No se usa `target-cpu=native`,
para conservar la portabilidad de los instaladores x86_64. El mayor cambio de
rendimiento está en el frontend, no en el pequeño envoltorio de Rust.

## Comprobación y empaquetado

Desde `juego` con las dependencias instaladas:

```sh
npm test
npm run typecheck
npm run build
npm run dist:linux
```

En Windows, los tres primeros comandos son iguales y los instaladores se generan
con `npm run dist:windows`. El flujo de GitHub existente conserva los cuatro
formatos: `.exe`, `.msi`, `.AppImage` y `.deb`; ejecuta las pruebas antes de empaquetar.
Las pruebas no necesitan nuevas dependencias de npm. La revisión no publica una
release ni modifica etiquetas de Git.

## Validación en hardware

Para una comparación útil, repetir la misma pista, modo, número de bots, tamaño de
ventana y perfil. Comparar tiempos de cuadro durante una carrera, después de la
compilación inicial de shaders. Probar los paquetes nativos: Chromium por sí solo
no valida WebKitGTK. Comprobar también que sombras y partículas se ven bien,
cambio de pista, pausa/reanudación y que la selección de calidad persiste.

Los cambios de código no instalan ni actualizan controladores del sistema. Tampoco
permiten afirmar compatibilidad con cada versión de controlador sin probarla.

Referencias oficiales:
- https://v2.tauri.app/reference/webview-versions/
- https://r3f.docs.pmnd.rs/advanced/scaling-performance
- https://threejs.org/docs/pages/InstancedMesh.html

## Segunda pasada: recursos y correcciones

Los cuatro modelos especiales de `ModeModels` se crean únicamente cuando están
seleccionados. Las transformaciones elegidas siguen cargadas antes de salir a la
pista. Se conserva su geometría, textura y animación. Los aviones extruidos
reutilizan geometrías y liberan sus recursos al desmontarse.

Los efectos del vehículo guardan una lista de materiales únicos. La explosión
restaura el color emisivo original al terminar. Fantasma restaura opacidad,
transparencia y escritura de profundidad, incluidos los cristales transparentes
con opacidad 1. No se recorre el árbol del vehículo dos veces por cuadro.

Las texturas de color de carretera y carteles se marcan como sRGB y se liberan
cuando cambian o dejan de usarse. El postprocesamiento añade FXAA para suavizar
bordes. Los efectos ambientales emiten a ritmo constante y no llenan el grupo de
partículas con emisores cuyo arco completo queda fuera de la vista.

Se recupera el idioma guardado, se completan controles antiguos parciales y se
rechazan tipos de preferencias incorrectos. Perder el foco limpia también botones
táctiles y pulsaciones pendientes. El teclado del juego no captura teclas de los
menús y mantener Escape/P no alterna la pausa repetidamente. Al abandonar la carrera
se limpia el temporizador de resultados y se silencia el derrape.

El DEB deja de exigir `libayatana-appindicator3-1`: el juego no usa bandeja del
sistema. Se mantienen GTK/WebKitGTK y el bootstrapper de WebView2 existente. El
perfil nativo favorece un ejecutable más pequeño sin modificar la calidad del
renderizado. Los tamaños reales de los instaladores deben medirse al empaquetarlos.

Referencias adicionales:
- https://threejs.org/manual/pages/color-management.html
- https://react-postprocessing.docs.pmnd.rs/effects/fxaa
- https://v2.tauri.app/concept/size/
- https://v2.tauri.app/distribute/debian/

## Tercera pasada: mapa, cámara y conducción

Opciones → Juego → Estilo de cámara ofrece Seguimiento, Inmersiva y Estable.
Inmersiva acerca la cámara e inclina hasta unos 1.4° al girar. Estable conserva
el FOV en 64°, sin inclinación ni sacudidas por impactos. La preferencia persiste.
La cámara sigue el giro más corto, empieza en la parrilla y cambia directamente
al nuevo lugar al reaparecer o cruzar un portal con un salto de más de 45 m.
Se acorta y baja en interiores y tramos cubiertos; no se añaden raycasts contra
cada objeto del escenario por cuadro.

Los cañones buscan una zona sólida con 4 m detrás y 12 m delante. Se corrigen
los destinos dentro de huecos de Volcán y Cascada sin eliminar los huecos ni sus
saltos. La prueba recorre los cañones de los 41 circuitos y consulta el suelo
real por altura, además de comprobar que la física mantiene el coche apoyado.

El vuelo, el suavizado de dirección, la deriva y las inclinaciones del vehículo
usan amortiguación por tiempo, calibrada a la respuesta anterior a 60 Hz. Soltar
el acelerador no puede hacer que la fricción invierta la marcha. Se elimina una
asignación de vector por piloto y paso de simulación para calcular las estelas.
La cuenta atrás utiliza tiempo de simulación y se congela durante la pausa local;
reanudar no arranca la carrera antes de que termine. La pausa de una sesión en red
conserva la regla existente de no detener a los demás participantes.

El minimapa muestra los pilotos desde la parrilla. Dibuja al jugador encima de
los rivales, conserva huecos cortos entre muestras y cierra la pista exactamente
en su inicio. La capa estática se almacena también a resolución HiDPI (máximo 2×)
y se regenera al cambiar de densidad o paleta; sigue limitado a 20 Hz.

Validación: 27 pruebas, TypeScript y build web. El simulador headless simplificado
completa dos vueltas por trazado principal y rutas de Volcán y Cascada sin caídas
con estos cambios. Esa simulación no sustituye una prueba completa de todas las
transformaciones ni la validación de instaladores y controladores en Windows/Linux.

Las uniones del minimapa se pintan por bandas de altura: primero el borde y luego
el relleno. Esto evita que cada pequeño segmento tape el anterior con su borde,
conservando la lectura de puentes. Las sombras usan explícitamente `percentage`
(PCFShadowMap); es el modo al que Three.js ya reconducía PCFSoftShadowMap,
eliminado en la versión instalada, por lo que no se reduce su calidad efectiva.

## Cuarta pasada: cámara dinámica, personalidad y recursos

La cámara anticipa la curva del trazado por el que se circula, con un ángulo
limitado; no anticipa al ir marcha atrás o apuntar fuera de la carretera. El turbo
abre la vista y aumenta la distancia de forma progresiva. Los saltos y aterrizajes
mueven ligeramente la cámara mediante un resorte amortiguado; se borra su estado
en los cortes de cámara de portales/reapariciones. Las sacudidas usan tiempo
transcurrido en lugar de ruido aleatorio distinto en cada cuadro. Estable conserva
FOV fijo, sin desplazamientos reactivos, inclinación ni sacudidas.

Los pilotos se inclinan y acompañan la aceleración; el peso del personaje activo
cambia la amplitud del gesto. La carrocería comprime la suspensión al aterrizar y
recupera su forma con una deformación pequeña que conserva el volumen. Se ven
las ruedas delanteras girar con la dirección y giran a la velocidad real,
incluida la marcha atrás. No siguen girando cuando el coche está quieto.

Un salto real de al menos 0.45 segundos con aterrizaje limpio recarga entre 8% y
12% de turbo, como máximo una vez al tocar el suelo. No lo conceden baches cortos,
choques contra barreras, rescates, aterrizajes sin velocidad hacia delante ni
vuelo controlado de avión/submarino. Se muestra un aviso breve y un sonido
procedural. Soltar un derrape cargado anuncia su nivel de mini-turbo. Los dos
avisos tienen traducción en los ocho idiomas del juego. No se añade una tecla
ni se cambia el protocolo de red.

Las cuatro ruedas de cada vehículo comparten dos geometrías y dos materiales,
con el mismo detalle anterior. Los materiales se mantienen privados de cada
vehículo para que Fantasma/explosión no alteren a los rivales. El giro y la
dirección se actualizan desde el mismo callback del vehículo, sustituyendo cuatro
callbacks de ruedas. No se construyen ruedas ocultas para formas sin ruedas ni
los accesorios predeterminados de barco/avión cuando se eligió otro modelo.
Tanque y Órbita tienen sus animaciones en componentes propios; cambiar de chasis
ya no cambia el número de hooks del mismo componente React.

La vegetación instanciada se divide por celdas de 128 m, compartiendo geometría y
material. Así el renderer puede descartar celdas fuera de cámara en lugar de
enviar el grupo de toda la pista. No se elimina ningún objeto ni se reduce su
geometría. Las geometrías, materiales y buffers de instancia se liberan al salir.

Validación automatizada: 39 pruebas, TypeScript y build web. Incluye resortes y
cámara a 30/60/144 Hz, límites de premios, aislamiento de materiales y conservación
de todas las matrices/colores al dividir instancias. Las ganancias de FPS y la
compatibilidad de los instaladores deben medirse en los equipos de destino.

En la comparación instrumentada de Bahía Aero, carrera rápida, semilla 125 y
parrilla pausada: geometrías únicas 1452 → 1343, materiales únicos 1479 → 1370.
Se cuentan también modelos ocultos. La sonda solo existe en copias temporales de
prueba. Los contadores de triángulos e instancias visibles incluyen partículas
ambientales variables; no son una medida de FPS ni de memoria en bytes.
La prueba visual comprobó Tanque → Órbita → Kart, estilos de rueda, vistas de
Yate/Jet Furtivo, cámara Inmersiva y el aviso de mini-turbo, sin errores de ejecución.

## Quinta pasada: modelos, ambientación y modos por trazado

Los vehículos reciben pilotos con parpadeos desfasados por personaje, manos,
luces de posición según su modo y pequeños paneles/aletas que responden al giro
en vuelo. Las luces se dibujan con instancias, sin luces puntuales adicionales ni
pasadas de sombra. Los acabados del garaje se aplican también a las superficies
pintadas de Cohete, Yate, Furtivo, Buceador y otros modelos que los ignoraban.
La cámara del garaje calcula los límites del modelo visible y encuadra vehículos
altos o anchos; excluye los efectos y las transformaciones ocultas.

Las 41 pistas tienen una capa adicional de ambientación determinista, con flores,
balizas, boyas, drones o ventiladores según el entorno. Se limita a 64 elementos
en exteriores y 32 en interiores. Se agrupa en celdas de 128 metros, comparte
tres geometrías y dos materiales, y actualiza las celdas visibles a 30 Hz.
Las colocaciones exteriores evitan las carreteras y los ventiladores interiores
se colocan en altura. Las partículas submarinas usan burbujas y los interiores
usan polvo. El agua usa un mapa normal procedural de 128 x 128 con mipmaps y
desplazamiento UV, sin subdividir las superficies ni descargar texturas.
Todas las zonas acuáticas exteriores generan su superficie, no sólo la primera.

La transformación usa la ruta real: un desvío sólido continúa en modo terrestre
aunque su progreso coincida con un canal o corredor de vuelo del trazado principal.
La auditoría encuentra ocho desvíos afectados a lo largo de siete pistas:
Arrecife Profundo, Archipiélago, Gran Odisea, Atlántida, Glaciar Aurora,
Muelle Aqua y Pantano Slime. Los puntos de
unión de otras rutas también se verifican. Se reinician el derrape cargado y el
desplazamiento de ascenso al cambiar de modo; portales, rescates, cañones y
reapariciones sincronizan el modo al nuevo punto. El artillero fusionado muestra
el modo real del conductor, incluido barco, submarino y levitación.

Validación: 49 pruebas automatizadas, comprobación TypeScript y build web.
La suite recorre los 41 circuitos y sus trazados, límites de transformación,
superficies de desvíos con física real, vuelo/buceo de crucero, colocación de
ambientación, encuadre de modelos y datos de agua. No equivale a completar
manualmente 41 carreras. Los FPS, controladores e instaladores nativos requieren
validación en los equipos Linux/Windows de destino.

## Sexta pasada: ritmo, diez vehículos y actividad cercana

Se añaden dos modelos de cada modo: Rally Aero y Roadster de Cristal; Hidroala y
Trimarán Solar; Ala Canard y Convertiplano VTOL; Nautilus y Explorador Raya;
Tríada Magnética y Anillos Flux. Usan siluetas propias y piezas de geometría
compartida dentro de cada modelo seleccionado, con cinco materiales privados por
modelo como máximo. Hélices, rotores, campos y aletas tienen animación. Los nombres
están traducidos a los ocho idiomas. No se agregan dependencias ni texturas.

Las 41 pistas reciben actores locales cerca de la ambientación: mariposas, peces
y drones. Hay como máximo 24 actores exteriores o 12 interiores, con dos dibujos
instanciados y actualización a 30 Hz; sólo los actores dentro de cámara se envían
al renderer. Su movimiento usa tiempo absoluto y evita invadir carreteras desde
los márgenes. La decoración y los trazados anteriores se conservan.

La aceleración aumenta un 8%. La velocidad de crucero puede aumentar hasta 26%
en rectas despejadas, o 14% en interiores. El perfil se calcula una vez por pista,
con límites continuos. Se retira antes de curvas cerradas, rampas pronunciadas,
agujeros, cruces, saltos/cañones y cambios de modo; se inhibe al derrapar, sufrir
daño, ir marcha atrás, volar sobre un salto o apuntar fuera del trazado. Se aplica
a jugador y rivales. El turbo manual conserva su función y los vehículos nuevos
quedan dentro de los rangos de estadísticas de los anteriores.

El bonus de tiempo deja de usar 55 segundos por vuelta para cualquier circuito.
Ahora su referencia depende de la distancia del recorrido principal y su perfil
de ritmo, manteniendo una referencia común para todos los corredores del mapa.
Los desvíos siguen pudiendo ahorrar tiempo. No se borran puntuaciones guardadas.

Validación: 60 pruebas, TypeScript y compilación web. Auditoría automatizada de
las 41 pistas: dos vueltas por el recorrido principal y dos tomando desvíos, con
física, reglas de vuelo/buceo y ritmo. Sin caídas ni casos sin terminar en esta
simulación simplificada. No reproduce objetos, combate ni todos los controles de
Scene. Se puede repetir con `cd juego` y `npm run audit:tracks`; el argumento
`all baseline` omite el ritmo de crucero para la comparación. Las ganancias de
FPS, instaladores y controladores requieren validación nativa en equipos destino.

## Séptima pasada: rutas, cámara y trampas con interacción

La velocidad máxima general aumenta un 15% y la aceleración un 12% respecto a
la sexta pasada, aplicando factores comunes a las estadísticas existentes. Se
conservan las diferencias de personajes, piezas y modos, además del crucero
selectivo y el turbo manual. La referencia de tiempos y los récords anteriores
no equivalen a los de esta nueva versión del ritmo.

Hay una ruta adicional en cada uno de los 41 mapas, con dos zonas de impulso.
35 son más cortas que el tramo principal sustituido; las otras seis ofrecen un
carril alternativo con impulso. Incluyen conexiones terrestres, de agua, vuelo,
buceo y levitación. Se guardan coordenadas ya verificadas: el juego no busca ni
genera candidatos durante la carrera. Las incorporaciones elevadas mantienen
el nivel del acceso hasta separarse de la carretera original.

La cámara transporta su posición y su objetivo con el coche antes de suavizar
su desplazamiento relativo. Así no añade distancia proporcional a la velocidad.
Se acerca y baja en carretera, agua, buceo y vuelo; anticipa más las curvas,
acompaña derrapes de barcos y levitadores, y limita el campo de visión dinámico.
Se mantiene dentro de los laterales de los pasillos. El buceo/vuelo mira a la
altura del vehículo. Estable conserva FOV fijo e inclinación nula.

Las pistas tienen entre uno y cuatro eventos locales señalizados: surtidores,
corrientes, pistones, barridos o brotes, según el modo y el entorno. Tienen
preaviso amarillo de 1.4 segundos, una fase peligrosa roja breve y una mitad de
carretera libre. Un golpe reduce velocidad de forma moderada, respetando el
agarre/peso; no quita monedas ni vidas. Pasar cerca de un evento activo puede
recargar hasta 4% de turbo, una vez por obstáculo y vuelta, sin repetir vueltas
anteriores ni reclamarlo marcha atrás. Jugador y rivales interactúan con ellos;
los rivales anticipan su señal y los esquivan. Se suprime el crucero automático
al aproximarse a un evento activo o con aviso.

Correcciones: las barreras de vuelo permiten incorporarse a un corredor
adyacente real; antes podían impedir entrar a un desvío submarino. Los canales
alternativos de piscina reciben su superficie de agua. Las trampas antiguas
respetan active=false, tienen un tamaño acotado y golpean por distancia física,
no por una fracción de la vuelta. Los obstáculos usan el reloj de carrera y
permanecen quietos durante la pausa. Se respetan mapas que declaran cero obstáculos
clásicos, se cachean posiciones/normales y se reutiliza el estado de colisión.
Las reapariciones de objetos y monedas usan tiempo transcurrido coherente con la
simulación a 20/30/60/144 FPS y se congelan al pausar una partida local.

Validación: 75 pruebas, TypeScript y build web. Auditoría general de 82 recorridos
y prueba específica de entrada, recorrido y salida de las 41 rutas nuevas a
30 y 60 Hz. Son simulaciones de superficies/conducción, no de todo el combate.
Los instaladores y controladores nativos siguen requiriendo pruebas en destino.

## Ajuste de adrenalina: activación sin aviso

Se elimina la fase de preaviso ambiental, junto con las luces amarillas, los
anillos y las balizas de espera. Las trampas irrumpen directamente, con subida
visual de 50 ms y destello al activarse. El pedestal queda como pieza neutra del
entorno. La IA solo reacciona al obstáculo ya activo. También se elimina la
supresión automática del crucero al acercarse a estos eventos: el jugador
conserva su velocidad y decide cómo esquivarlos.

Se mantienen los límites de colisión, el tiempo de pausa y la recompensa por
pasar cerca. La velocidad y las estadísticas conservan el ajuste de la séptima
pasada. Este cambio sustituye su descripción anterior de aviso amarillo.

## Adrenalina, parte 1: combos, rebufo y sonido de carrera

Las maniobras limpias alimentan una cadena de seis segundos: derrapes con
mini-turbo, aterrizajes válidos, esquivas ambientales, adelantamientos y salida
de rebufo. Se exige avance real de al menos 12 metros y separación temporal
entre recompensas. La cadena llega a ocho acciones y multiplicador de puntos
x2; la recompensa por acción añade entre 1.4% y 4% de turbo, acotada al depósito.
Los puntos de combo se conservan al romper la cadena y se incluyen en el resultado.
Choques, caídas, golpes y marcha atrás cortan la cadena. El contador usa tiempo
de simulación y queda congelado durante la pausa local.

El rebufo conserva el llenado de 1.3 segundos, pero ahora sigue a un rival
concreto del mismo corredor, modo, altura y sentido. Solo suelta el impulso
cargado al abrirse lateralmente junto a ese rival. Frenar, saltar, perder el
objetivo o cambiar de rival no concede un impulso gratuito. El impulso dura
0.85 veces la estadística de duración y usa 0.27 veces la potencia de turbo.
Los rivales locales tienen la misma mecánica y economía de combos.

Los adelantamientos exigen aproximación y cruce limpios, proximidad, continuidad
y el mismo trazado/sentido. Solo se premia una vez a cada rival por vuelta; los
saltos de posición, el contacto y volver a vueltas anteriores invalidan el premio.

Se añade una base musical procedural de carrera, voz de motor distinta para
carretera/barco/avión/submarino/levitación y viento según velocidad. La última
vuelta añade melodía, percusión y ritmo, junto a un acento suave en el borde de
pantalla. El HUD muestra el combo, multiplicador y tiempo restante. Los textos
nuevos están traducidos a los ocho idiomas. Estable y movimiento reducido
mantienen fijo el acento del borde; al pausar se detiene su animación.

El audio comparte cuatro osciladores y un búfer de ruido, sin nuevos archivos,
dependencias, temporizadores ni nodos por golpe de percusión. Respeta silencio,
volumen, pausa, final de carrera y desmontaje de la escena. La animación del borde
modifica opacidad, sin recalcular sombras en cada fotograma.

Validación: 85 pruebas automatizadas, TypeScript y build web. Las nuevas pruebas
cubren cadencia 20/30/60/144 Hz, repetición de premios, adelantamientos, rebufo y
silencio/reutilización de voces. La revisión visual usa una copia separada con
escenario preparado para el HUD y una carrera normal. No sustituye escucha y
ajuste en distintos equipos, partidas de red ni pruebas de instaladores nativos.

Parte posterior prevista: atajos con riesgo, transformaciones por vuelta,
maniobras específicas por vehículo y personalidades de rivales más marcadas.
Las trampas ambientales siguen sin preaviso.

## Adrenalina, parte 2: atajos de riesgo y evolución de las pistas

Cada uno de los 41 mapas incorpora tres zonas de desafío: una en el desvío nuevo
y dos en la ruta principal, 123 en total. La carretera usa compuertas deslizantes;
barcos/submarinos reciben corrientes, los aviones ráfagas y los levitadores campos
magnéticos. Las compuertas dejan una abertura móvil de al menos cinco metros, que obliga a
cambiar de línea en parte de su ciclo.
Los campos dejan un canal sin empuje; fuera de él aplican deriva lateral acotada
según estadísticas. Las compuertas bloquean el avance, pero permiten deslizarse
lateralmente para alcanzar el hueco. El modo fantasma atraviesa la compuerta sin
obtener el premio de un recorrido limpio.

Los desvíos tienen su desafío desde el inicio. En la ruta principal las máquinas
se activan en la segunda vuelta de cabeza de carrera; en la tercera cambian el
hueco, la amplitud o la fuerza. Cada zona espera a estar libre de corredores en
un radio de 35 metros antes de cambiar de fase. La fase es compartida por todos
los cuerpos y el dibujo en cada instancia local. En batalla no se progresa por
vueltas ni se otorga la bonificación de ruta. No se elimina suelo ni se modifican
los apoyos estáticos del circuito.

Superar el desvío completo, cruzar su desafío y salir por la conexión real sin
golpes permite ganar 180 puntos y hasta 6% de turbo, más la contribución de combo
si corresponde. Se concede una vez por vuelta. Entrar a mitad de camino, ir hacia
atrás, saltar posiciones, caer o usar fantasma invalida el premio. Un salto limpio
sobre una compuerta puede contar como cruce válido. Todo usa el reloj de carrera
y queda congelado durante la pausa local. El cambio de paleta conserva ese reloj;
al transformar el vehículo se limpia la deriva residual. No hay preaviso amarillo
ni cuenta atrás de obstáculos; se ve su geometría y estado actuales.

La IA sigue las aberturas y canales reales. Al elegir un desvío deja de apuntar
a un desafío de la carretera principal que ese desvío sustituye. La selección
comprueba la distancia a lo largo del trazado para no confundir secciones cercanas
en una curva cerrada.

Se corrigió el acceso al desvío de Tux: sus primeros puntos no coincidían con la
altura del suelo compartido y podía recorrerse la principal tras rozar solo la
salida. La entrada ahora conserva esa altura y la bajada es continua. La prueba
exige cruzar el desafío del desvío, además de entrar y salir.

Se comparten geometrías/materiales y se ocultan las máquinas lejanas; las ubicaciones
se calculan una sola vez al cargar cada circuito. Sin nuevas dependencias, texturas,
luces puntuales ni efectos de posprocesado.

Validación: 101 pruebas, TypeScript y compilación web. Auditoría específica de 246
recorridos: 41 desvíos por tres fases a 30/60 Hz, con entrada, cruce de desafío y
salida completados sin caídas. Auditoría adicional de los 82 recorridos generales
del proyecto. Las simulaciones de desvíos comparten challengeMotion con Scene;
la auditoría general comprueba el trazado existente, sin combate ni todas las
mecánicas nuevas. La revisión visual usa otra copia con posición/fase/reloj
preparados y excluida del proyecto y HTML finales. La red y los instaladores
nativos requieren validación específica en destino.

Quedan para la parte siguiente maniobras propias de cada vehículo y personalidades
más diferenciadas de los rivales. Esta entrega no añade derrumbes ni inundaciones
de suelo físico.


## Adrenalina: maniobras, rivales, terreno y mandos

El botón de derrape también activa una maniobra según el modo: tonel del avión,
inmersión rápida del submarino, desplazamiento magnético lateral, salto del barco
al ir recto y acrobacia del coche en el aire. Hay enfriamiento y requisitos de
velocidad, avance real y ejecución limpia. Las acrobacias de coche y barco se
premian tras aterrizar. Golpes, caídas, transformación, fusión y cañones cancelan
la maniobra pendiente y devuelven el modelo a su orientación normal.

La IA tiene cuatro estrategias según el papel del personaje: atacantes, exploradores
de atajos, velocistas que reservan turbo para adelantar o la última parte de carrera,
y especialistas en derrape. Se modifican decisiones, distancias y tiempos de uso;
se conservan las estadísticas del vehículo y los perfiles de dificultad.

Hay derrumbes reales de media plataforma en 37 circuitos y agua creciente sobre
la carretera en 40. La selección exige tramos sólidos, rectos, sin túneles ni
intersecciones con otra carretera. El carril conservado tiene al menos 5,5 m de
ancho. Plataforma, borde y barandilla caen juntos; la física retira ese mismo suelo.
El agua es una inundación somera (hasta 32 cm), afecta rodadura/inercia y sonido;
no transforma un coche en barco. Estas ubicaciones son adicionales a las máquinas,
rutas y peligros ya presentes en los 41 circuitos.

Los cambios de suelo se activan por vuelta cuando la zona está libre, sin aviso
previo. Se mantienen en carreras locales: en batalla y en partidas en red el suelo
permanece estable. La sincronización de cambios físicos del mundo por red necesita
un protocolo específico; así se evitan suelos distintos entre clientes. La IA
centra la mirada al pasar por el carril conservado y las compuertas se sitúan lejos
del derrumbe. Se amplió también el margen de entrada/salida junto a huecos existentes.

Se añadió sonido de rodadura, agua, aire y magnetismo al mezclador procedural. La
capa de superficie comparte el generador de ruido existente; no carga muestras de
audio. Los aterrizajes dependen de su impacto y los adelantamientos tienen posición
estéreo. Se respetan volumen, silencio y pausa. El modelo muestra el giro o la
inclinación de la maniobra sin trasladar ese tonel a la cámara.

El mando estándar usa RT/LT para acelerar/frenar, palanca izquierda para girar
(y controlar altura), A para objeto, B para derrape/maniobra, X para turbo, LB para
cambiar, RB para fusión y Start para pausa. Hay zona muerta de 18 %, gatillos
analógicos y bloqueo hasta soltar controles tras conectar o recuperar foco. Se
mantienen teclado y controles táctiles. Las indicaciones y recompensas están
traducidas a los ocho idiomas existentes. La disponibilidad del mando depende de
la API Gamepad del navegador/WebView y de los controladores del sistema; faltan
pruebas con dispositivos físicos en Linux y Windows.

### Construcción y validación

`npm run build` usa el cargador runner de Vite para evitar escribir una configuración
temporal dentro de node_modules. `npm run dist:linux` construye con Tauri, obtiene
el directorio de salida con Cargo y calcula los requisitos GLIBC del ejecutable con
readelf. El .deb declara esa versión y evita duplicar las dependencias GTK/WebKit.
La fase GTK del AppImage recibe solo los archivos directos de las bibliotecas
correspondientes de pkg-config, sin explorar bibliotecas privadas de otros programas.
Los módulos, temas y dependencias transitivas conservan su resolución habitual.
No se añadieron dependencias de npm o Cargo.

Se comprobaron 131 pruebas automatizadas, TypeScript y compilación web, 246
recorridos de desvíos (41 pistas por tres fases a 30/60 Hz) y los 82 recorridos
generales existentes. Las simulaciones usan moveBody/challengeMotion y verifican
entrada, desafío y salida; no sustituyen una carrera con todo el combate ni pruebas
reales de GPU. Los eventos de suelo tienen además pruebas de soporte físico,
carril conservado, pausa, reinicio y filtrado de biblioteca/ABI de los paquetes.

El informe de esta entrega registra los tamaños y resultados nativos concretos.
La compilación local requiere GLIBC 2.39 para su ejecutable; un paquete creado en
este equipo no demuestra compatibilidad con distribuciones más antiguas. Para
distribuir a más sistemas conviene construir desde la base Linux más antigua que
se pretenda soportar. Windows conserva los destinos NSIS/MSI y necesita validación
nativa de instalación, mandos y GPU. Las capturas de escenarios proceden de una
copia de revisión con posición/vuelta/reloj preparados; esa instrumentación está
excluida del proyecto y del HTML entregados.


Resultado nativo de esta entrega: construcción optimizada y empaquetado Linux
completados. El .deb ocupa 2.403.624 bytes y el AppImage 108.046.840 bytes; el
proceso de cada formato permaneció activo durante la prueba de 20 segundos bajo
Xvfb y terminó por el límite programado. El .deb mostró el aviso DRI3 de la
pantalla virtual; el AppImage no registró errores. Esto comprueba el arranque
básico, no la aceleración gráfica ni una instalación administrativa. El .deb
local requiere GLIBC 2.39 y las bibliotecas del AppImage local GLIBC 2.44.
