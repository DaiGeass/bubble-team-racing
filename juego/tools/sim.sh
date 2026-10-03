#!/bin/sh
# Simulador sin gráficos: conduce un cuerpo por cada pista y cuenta caídas, roces y tiempos.
#   tools/sim.sh            todas las pistas
#   tools/sim.sh torre      una pista
#   tools/sim.sh check      geometría de las pistas diseñadas (cierres, radios, pendientes, cruces)
cd "$(dirname "$0")/.."
node_modules/.bin/esbuild tools/sim.ts --bundle --platform=node --format=esm --outfile=/tmp/btr-sim.mjs --log-level=error && node /tmp/btr-sim.mjs "$@"
