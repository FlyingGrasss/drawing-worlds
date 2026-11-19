# AGENTS

Greenfield demo app; anonymous public worlds.

- Single package: Next.js App Router (`src/app`) plus a standalone Node WebSocket server (`server/`).
- Use pnpm. Node 20.12+.
- Next runs on port 3000; the WebSocket server runs on port 4100 (`/ws`).
- `shared/` is the protocol boundary and must stay framework-free.
- Worlds are public and keyed by slug. There are no accounts or private data.
- Server state is authoritative; strokes are persisted to `.data/worlds.json`.
- Client components and the real page shell live under `src/`; the current `src/app/layout.tsx` and `src/app/page.tsx` are temporary.
- Validate with `pnpm typecheck`, `pnpm typecheck:server`, `pnpm lint`, and `pnpm smoke:ws`.
