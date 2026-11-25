#!/bin/bash
# Executa a coleta completa. Defina as variáveis conforme o ambiente:
#   EXT  = build de teste da extensão (pnpm build:test -> .output/chrome-mv3-test)
#   WAVE = pasta da extensão WAVE descompactada
#   ACT  = casos ACT baixados (pnpm fetch:act -> tests/act/www)
# Uso: ./rodar.sh act bad sites
cd "$(dirname "$0")"
EXT="${EXT:-../.output/chrome-mv3-test}"
WAVE="${WAVE:?defina WAVE com a pasta da extensão WAVE descompactada}"
ACT="${ACT:-../tests/act/www}"
for g in "$@"; do node coleta.mjs --ext "$EXT" --wave "$WAVE" --act "$ACT" --grupo "$g" $EXTRA >> "log-$g.txt" 2>&1; done
