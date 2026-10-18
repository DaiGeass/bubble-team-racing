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
