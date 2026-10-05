#!/bin/sh
set -e
# scratch build of the project sources with the test hook injected
S=/tmp/claude-1000/-home-DaiGeass-Descargas-Bubble-Team-Reacing/a763eeeb-c59d-457d-a36b-9756b2f524e6/scratchpad/w
P="/home/DaiGeass/Descargas/Bubble Team Reacing/juego"
rm -rf $S/src
cp -r "$P/src" $S/src
cd $S
python3 hook.py
node_modules/.bin/vite build --configLoader runner 2>&1 | grep -i "error\|built"
