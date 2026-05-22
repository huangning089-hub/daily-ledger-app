#!/bin/zsh
cd "$(dirname "$0")"
PORT=8124

if ! lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  python3 -m http.server $PORT >/tmp/daily-ledger-http.log 2>&1 &
  sleep 1
fi

open "http://127.0.0.1:$PORT/index.html"
