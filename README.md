# Drawing Worlds

Greenfield demo of anonymous, public drawing worlds. A Next.js 15 front end talks to a standalone Node WebSocket server that owns world state, presence, limits, and persistence.

## Requirements

- Node.js 20.12+
- pnpm 12

## Setup

```bash
pnpm install
cp .env.example .env
```

On PowerShell use `Copy-Item .env.example .env`. The defaults work without an `.env` file.

```bash
pnpm dev
```

- Web: http://localhost:3000
- WebSocket: ws://localhost:4100/ws
- Health: http://localhost:4100/healthz

`NEXT_PUBLIC_WS_URL` is the optional absolute browser WebSocket URL; leave it empty to use `ws://localhost:4100/ws`. `WS_PORT` changes the server port.

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm dev` | Next dev plus `tsx watch server/index.ts` |
| `pnpm dev:web` | Next dev only |
| `pnpm dev:ws` | WebSocket server only (no watch) |
| `pnpm smoke:ws` | End-to-end WebSocket smoke test on an ephemeral port |
| `pnpm build` / `pnpm start` | Production Next build / serve |
| `pnpm lint` | `next lint` |
| `pnpm typecheck` | Type-check the web/shared TypeScript |
| `pnpm typecheck:server` | Type-check `shared/` + `server/` |

## Layout

```
shared/          Protocol types, limits, validators (framework-free)
server/          HTTP + WebSocket server, world store, rate limiting, snapshots
server/smoke.ts  Two-client end-to-end test
src/app/         Temporary placeholder shell (owned by U2)
src/lib/         cn() helper and world slug/name helpers
```

## Protocol

`shared/protocol.ts` is the single contract. `PROTOCOL_VERSION` is `1`.

Client frames: `join`, `stroke:start`, `stroke:append`, `stroke:end`, `stroke:undo`, `cursor`, `world:clear`.

Server frames: `welcome`, `presence:join`, `presence:leave`, `stroke:start`, `stroke:append`, `stroke:end`, `stroke:remove`, `world:cleared`, `cursor`, `error`.

The server validates every frame, rejects messages over 24 KB, requires a join within 5 seconds, and broadcasts drawing events to every member (including the sender) in one order. Close codes: `4000` protocol abuse, `4001` world/server full, `4002` protocol mismatch, `4003` join timeout, `4008` abuse, `1013` slow consumer.

Worlds are limited to 30 concurrent clients, 1,000 strokes, 2,000 points per stroke, 120,000 points per world, and 32 appended points per message. Clear has a 3-second world cooldown and a 10-second per-client cooldown. Each connection has a 120-message burst token bucket refilling at 50 messages/second.

In production, browser origins must be listed comma-separated in `WS_ALLOWED_ORIGINS`. Development allows localhost, `file://`, and missing origins.

## Persistence

Strokes are saved to `.data/worlds.json` with a 2-second debounce using a temp file + atomic rename; shutdown flushes pending changes. Delete `.data/` to reset all worlds. Snapshots are restored tolerantly and re-checked against every cap.

Worlds are public and anonymous: do not put private content in them.

## Docker deployment

The repository includes `Dockerfile`, `.dockerignore`, `docker-compose.yml`, and `scripts/start.sh`. The image builds Next.js, then runs the WebSocket server (4100) and `next start` (3000) in one container as the non-root `node` user (UID 1000). `NODE_ENV=production` is fixed and no secrets are baked into the image.

```bash
cat > .env <<'EOF'
NEXT_PUBLIC_WS_URL=wss://draw.example.com/ws
WS_ALLOWED_ORIGINS=https://draw.example.com
EOF

docker compose up -d --build
docker compose logs -f app
```

- **`NEXT_PUBLIC_WS_URL` is build-time only.** `next build` inlines it into the browser bundle; setting it at runtime has no effect. It must be the public `wss://` URL of the WebSocket endpoint, normally `wss://draw.example.com/ws`. After changing it, rebuild: `docker compose build --no-cache app && docker compose up -d`.
- Required: `NEXT_PUBLIC_WS_URL` (build arg) and `WS_ALLOWED_ORIGINS` (comma-separated browser origins; production rejects browsers when empty). Both are enforced by `${VAR:?...}` in compose.
- Fixed in the container: `WS_PORT=4100`.
- Published port: `3000` only. Port `4100` is exposed on the Compose network for a reverse proxy; Next.js does not proxy WebSocket upgrades, so the proxy must route `/ws` directly to `app:4100`. If the proxy runs on the host, publish `4100:4100` as well. A commented Caddy example is in `docker-compose.yml`.
- Persistence: `./data` is bind-mounted at `/app/data`. The image symlinks `/app/.data` to `/app/data`, so the app's existing `.data/worlds.json` path lands on the mounted volume. Back up `data/worlds.json`. On Linux, make the directory writable by UID 1000: `mkdir -p data && sudo chown -R 1000:1000 data`.
- Health checks: `GET /` on 3000 and `GET /healthz` on 4100.
- Stop with `docker compose down`; data survives. The start script forwards `SIGTERM`, letting the WS server flush the snapshot.
