#!/usr/bin/env bash
set -Eeuo pipefail

export NODE_ENV="${NODE_ENV:-production}"
export WS_PORT="${WS_PORT:-4100}"

: "${WS_ALLOWED_ORIGINS:?WS_ALLOWED_ORIGINS is required in production}"

ws_pid=""
next_pid=""

cleanup() {
    trap - TERM INT
    if [[ -n "$next_pid" ]]; then
        kill -TERM "$next_pid" 2>/dev/null || true
    fi
    if [[ -n "$ws_pid" ]]; then
        # The WS server flushes .data/worlds.json on SIGTERM before exiting.
        kill -TERM "$ws_pid" 2>/dev/null || true
    fi
    wait 2>/dev/null || true
}
trap 'cleanup; exit 143' TERM INT

echo "[start] WebSocket server on 0.0.0.0:${WS_PORT}"
./node_modules/.bin/tsx server/index.ts &
ws_pid=$!

ws_ready=0
for _ in {1..30}; do
    if ! kill -0 "$ws_pid" 2>/dev/null; then
        echo "[start] WS server exited before becoming healthy" >&2
        cleanup
        exit 1
    fi
    if curl -fsS "http://127.0.0.1:${WS_PORT}/healthz" >/dev/null 2>&1; then
        ws_ready=1
        break
    fi
    sleep 1
done

if [[ "$ws_ready" -ne 1 ]]; then
    echo "[start] WS health check timed out" >&2
    cleanup
    exit 1
fi

echo "[start] Next.js on 0.0.0.0:3000"
./node_modules/.bin/next start -p 3000 &
next_pid=$!

status=0
wait -n "$next_pid" "$ws_pid" || status=$?
echo "[start] a process exited (status ${status}); shutting down"
cleanup
exit "$status"
