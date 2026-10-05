#!/bin/sh
# Reanuda la conversación del proyecto.
#   ./reanudar.sh            con Claude Code (esta conversación)
#   ./reanudar.sh opencode   con opencode
cd "$(dirname "$0")" || exit 1

case "$1" in
  opencode|o)
    exec opencode -s ses_f022d6834ffe3F7ZMqmZ72xXRH
    ;;
  *)
    # la sesión concreta; si ya no existe, la más reciente de esta carpeta
    claude --resume a763eeeb-c59d-457d-a36b-9756b2f524e6 || exec claude --continue
    ;;
esac
