# Desarrollo de mapas, cámara y habilidades

## Organización

- `src/raceRules.ts`: victoria, habilidades, vehículos disponibles y evolución física según pista, modo y conexión. Contrarreloj desactiva ataques propios; batalla usa vidas. El suelo evoluciona solo en carreras locales.
- `src/abilities.ts`: reserva por piloto, recarga por avance real y maniobras, recuperación compartida, adaptación del ataque al vehículo y selección espacial de objetivos.
- `src/camera.ts`: seguimiento, dinámica y estado de mirada trasera. Mirar atrás no modifica el volante ni la puntería de la torreta.
- `src/worldLife.ts` y `src/trackActors.ts`: reacción ambiental según proximidad, altura y velocidad. Las criaturas conservan sus órbitas validadas y estas animaciones siguen el reloj de carrera para detenerse en pausa local.
- `src/mapInspection.ts`: inspección reutilizable de rutas, anchuras, pendientes, modos y muestras inválidas.
- `src/game/Scene.tsx`: coordinación de estos módulos con física, combate, red e interfaz. Esta entrega inicia la separación; parte de la IA y del combate sigue dentro de Scene.

## Controles

| Acción | Teclado inicial | Mando estándar | Táctil |
| --- | --- | --- | --- |
| Mirar atrás mientras se mantiene | V | Pulsar palanca derecha | Mantener ↶ |
| Habilidad propia | C | Y / botón superior | Pulsar ✦ |

Ambas acciones se pueden reasignar en Opciones y en los botones táctiles existentes. Las preferencias antiguas reciben las nuevas teclas predeterminadas. Mirar atrás también dirige los objetos direccionales hacia perseguidores próximos en el mismo nivel. Los ataques propios de retaguardia conservan su dirección característica.

Las habilidades reutilizan los ataques definidos para cada personaje y se adaptan a los cinco vehículos. Empiezan al 35 %, se cargan al avanzar y al realizar maniobras válidas, con mayor recompensa por variar. Comparten reserva y espera al cambiar de personaje; no se reinician al transformar el vehículo ni al reaparecer. La ráfaga tiene hasta cinco disparos y recuperación de 10, 13 o 16 segundos según el rol.

No se activan en fusión, torreta, lanzamiento de cañón, aturdimiento, congelación, recuperación o con velocidad insuficiente. No gastan reserva si necesitan un objetivo y no hay uno válido, o si no caben los proyectiles o la trampa necesarios en las reservas existentes. Contrarreloj conserva los ataques desactivados.

## Diagnóstico F8

Abrir el juego con el servidor de desarrollo y pulsar **F8 durante una carrera**. Pulsar de nuevo para ocultar.

- Líneas de color: centro y modo de cada ruta; blanco: bordes.
- Amarillo: paredes declaradas y avance previsto de la IA.
- Azul: techo de túneles; verde: muestras con soporte; rojo: huecos y trampas ambientales activas.
- Línea cámara-piloto: referencia de vista y comprobación del suelo bajo la cámara.

No muestra todos los tipos de colisión ni todas las obstrucciones posibles. Usa el soporte real, incluido el lado caído de un puente. El diagnóstico se importa únicamente en desarrollo y queda excluido del HTML de producción.

## Validación

Desde `juego/`:

```sh
npm test
npm run typecheck
npm run build
npm run audit:maps -- informe-mapas.json
npm run audit:tracks
```

`audit:maps` inspecciona 41 circuitos y registra las reglas de 574 combinaciones: 41 mapas × 7 modos × local/red. Es una revisión de datos y políticas, no 574 carreras completas jugadas. El informe contiene las rutas y los elementos ambientales de cada mapa. `audit:tracks` ejecuta las simulaciones de conducción existentes.

Antes de cambiar una pista, revisar accesos y salidas de rutas, cambios de vehículo, cañones, reaparición y llegada. Al modificar ataques, revisar equipos, diferencias de altura, escudos, ausencia de objetivo, reservas de proyectiles y propagación de efectos en red. La mirada trasera debe conservar los controles.

## Trabajo posterior

Separar progresivamente la IA y la resolución del combate que siguen en Scene. Ampliar la simulación a carreras completas con fusión, cañones, reinicio y llegada. Sincronizar el estado del mundo antes de habilitar derrumbes en red. Validar en equipos físicos los controladores gráficos y mandos de Linux y Windows. Esta entrega no añade bibliotecas nativas ni modifica controladores.
