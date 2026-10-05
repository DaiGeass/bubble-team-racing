# Pruebas en navegador sin GPU

Guiones que usé para probar el juego real con Playwright (Python) y Chromium por software.
Estaban en una carpeta temporal; se guardan aquí para no perderlos.

- `sync.sh` copia `juego/src` a una carpeta de trabajo, le inyecta un gancho de pruebas
  (`window.__btr`, `__btrSpeed`, `__btrAuto`) y compila. **Las rutas de dentro apuntan a la
  carpeta temporal de aquella sesión: hay que cambiarlas antes de usarlo.** El gancho nunca
  se mete en `juego/src`.
- `hook.py` es el gancho que inyecta `sync.sh` (contadores de caídas, choques y golpes).
- `shot.py <pista> <condición JS sobre r> <prefijo> [n]` hace capturas cuando el jugador cumple la condición.
- La carpeta de trabajo necesita además `index.html`, `package.json`, `tsconfig.json`, `vite.config.ts` y un enlace a `node_modules`.
- `full.py` carreras completas de 3 vueltas con el jugador en piloto automático: errores y caídas.
- `level.py` mide cada nivel de dificultad. `tour.py` una vuelta de la IA por pista.
- `big.py` capturas a tamaño de escritorio. `dark.py` brillo de pantalla. `win.py` la victoria.
- `drift.py` muestrea cuánto derrapa la IA.

Todos se ejecutan desde la carpeta de trabajo que contiene `dist/index.html`.
