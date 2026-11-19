import { randomUUID } from "node:crypto";
import { createServer, type Server as HttpServer } from "node:http";
import { resolve } from "node:path";
import { WebSocket, WebSocketServer, type RawData } from "ws";
import { LIMITS } from "../shared/world.js";
import {
  PROTOCOL_VERSION,
  encodeServerMessage,
  parseClientMessage,
  type ClientMessage,
  type ErrorCode,
  type JoinMessage,
  type ServerMessage,
} from "../shared/protocol.js";
import { createPresence } from "./names.js";
import { TokenBucket } from "./rate-limit.js";
import { SnapshotStore } from "./snapshot.js";
import { WorldStore, type WorldResult, type WorldSession } from "./worlds.js";

const DEFAULT_PORT = 4100;
const DEFAULT_DATA_FILE = resolve(process.cwd(), ".data", "worlds.json");
const JOIN_TIMEOUT_MS = 5_000;
const HEARTBEAT_INTERVAL_MS = 30_000;
const MAX_BUFFERED_BYTES = 512 * 1024;
const MAX_PROTOCOL_STRIKES = 5;
const MAX_RATE_STRIKES = 5;
const MAX_CONNECTIONS = 200;

export interface ServerOptions {
  port?: number;
  host?: string;
  dev?: boolean;
  allowedOrigins?: string[];
  joinTimeoutMs?: number;
  heartbeatIntervalMs?: number;
  maxConnections?: number;
  /** `null` disables persistence (used by the smoke test). */
  snapshotPath?: string | null;
}

export interface RunningServer {
  port: number;
  httpServer: HttpServer;
  wss: WebSocketServer;
  store: WorldStore;
  snapshot: SnapshotStore | null;
  close(): Promise<void>;
}

interface Connection {
  id: string;
  ws: WebSocket;
  bucket: TokenBucket;
  world: string | null;
  session: WorldSession | null;
  joined: boolean;
  isAlive: boolean;
  joinTimer: NodeJS.Timeout | null;
  protocolStrikes: number;
  rateStrikes: number;
  closing: boolean;
}

function parseOriginList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isAllowedOrigin(
  origin: string | undefined,
  dev: boolean,
  allowlist: string[],
): boolean {
  // Non-browser clients (tests, scripts) do not send Origin.
  if (!origin) return true;

  if (dev) {
    if (origin === "null" || origin.startsWith("file://")) return true;
    try {
      const parsed = new URL(origin);
      const localHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
      return (
        (parsed.protocol === "http:" || parsed.protocol === "https:") &&
        localHosts.has(parsed.hostname)
      );
    } catch {
      return false;
    }
  }

  return allowlist.includes(origin);
}

function readPort(raw: string | undefined): number {
  if (!raw) return DEFAULT_PORT;
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 65_535 ? parsed : DEFAULT_PORT;
}

function textFromRawData(data: RawData): string {
  if (Buffer.isBuffer(data)) return data.toString("utf8");
  if (Array.isArray(data)) return Buffer.concat(data).toString("utf8");
  return Buffer.from(data).toString("utf8");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

function send(connection: Connection, message: ServerMessage): void {
  if (connection.closing || connection.ws.readyState !== WebSocket.OPEN) return;
  if (connection.ws.bufferedAmount > MAX_BUFFERED_BYTES) {
    closeSocket(connection, 1013, "slow consumer");
    return;
  }
  try {
    connection.ws.send(encodeServerMessage(message));
  } catch {
    connection.ws.terminate();
  }
}

function sendError(
  connection: Connection,
  code: ErrorCode,
  message?: string,
  extra: { retryAfterMs?: number; strokeId?: string } = {},
): void {
  send(connection, {
    type: "error",
    code,
    ...(message ? { message } : {}),
    ...(extra.retryAfterMs !== undefined ? { retryAfterMs: extra.retryAfterMs } : {}),
    ...(extra.strokeId ? { strokeId: extra.strokeId } : {}),
  });
}

function closeSocket(connection: Connection, code: number, reason: string): void {
  if (connection.closing) return;
  connection.closing = true;
  if (connection.joinTimer) {
    clearTimeout(connection.joinTimer);
    connection.joinTimer = null;
  }

  try {
    if (connection.ws.readyState === WebSocket.OPEN) {
      connection.ws.close(code, reason.slice(0, 123));
    } else {
      connection.ws.terminate();
    }
  } catch {
    connection.ws.terminate();
  }

  const terminateTimer = setTimeout(() => {
    if (connection.ws.readyState !== WebSocket.CLOSED) connection.ws.terminate();
  }, 1_000);
  terminateTimer.unref?.();
}

function applyResult(connection: Connection, result: WorldResult): void {
  if (!result.ok) {
    sendError(connection, result.error.code, result.error.message, {
      retryAfterMs: result.error.retryAfterMs,
      strokeId: result.error.strokeId,
    });
    return;
  }
  if (result.warning) {
    sendError(connection, result.warning.code, result.warning.message, {
      retryAfterMs: result.warning.retryAfterMs,
      strokeId: result.warning.strokeId,
    });
  }
}

export async function startServer(options: ServerOptions = {}): Promise<RunningServer> {
  const dev = options.dev ?? process.env.NODE_ENV !== "production";
  const port = options.port ?? readPort(process.env.WS_PORT);
  const host = options.host ?? "0.0.0.0";
  const joinTimeoutMs = options.joinTimeoutMs ?? JOIN_TIMEOUT_MS;
  const heartbeatIntervalMs = options.heartbeatIntervalMs ?? HEARTBEAT_INTERVAL_MS;
  const maxConnections = options.maxConnections ?? MAX_CONNECTIONS;
  const allowedOrigins = options.allowedOrigins ?? parseOriginList(process.env.WS_ALLOWED_ORIGINS);
  const snapshotPath =
    options.snapshotPath === undefined ? DEFAULT_DATA_FILE : options.snapshotPath;

  if (!dev && allowedOrigins.length === 0) {
    console.warn(
      "[ws] WS_ALLOWED_ORIGINS is empty; browser connections are rejected in production",
    );
  }

  const store = new WorldStore();
  const snapshot = snapshotPath ? new SnapshotStore(store, snapshotPath) : null;
  if (snapshot) await snapshot.load();
  store.onChange = () => snapshot?.schedule();

  const connections = new Map<string, Connection>();

  const httpServer = createServer((request, response) => {
    const pathname = (request.url ?? "/").split("?")[0];
    if (request.method === "GET" && pathname === "/healthz") {
      response.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      });
      response.end('{"ok":true}');
      return;
    }
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  });

  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: LIMITS.maxMessageBytes,
    clientTracking: true,
  });

  httpServer.on("upgrade", (request, socket, head) => {
    const pathname = (request.url ?? "/").split("?")[0];
    if (pathname !== "/ws") {
      socket.destroy();
      return;
    }
    if (!isAllowedOrigin(request.headers.origin, dev, allowedOrigins)) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
      socket.destroy();
      return;
    }
    if (connections.size >= maxConnections) {
      // Complete the handshake so the client receives the documented close code.
      wss.handleUpgrade(request, socket, head, (ws) => {
        try {
          ws.send(
            encodeServerMessage({
              type: "error",
              code: "SERVER_FULL",
              message: "server is full",
            }),
          );
        } catch {
          // The socket may already be gone.
        }
        ws.close(4001, "server full");
      });
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  function protocolViolation(connection: Connection, message: string): void {
    sendError(connection, "BAD_MESSAGE", message);
    connection.protocolStrikes += 1;
    if (connection.protocolStrikes >= MAX_PROTOCOL_STRIKES) {
      closeSocket(connection, 4000, "protocol abuse");
    }
  }

  function handleJoin(connection: Connection, message: JoinMessage): void {
    if (connection.joined) {
      sendError(connection, "BAD_MESSAGE", "already joined a world");
      return;
    }
    if (message.protocolVersion !== PROTOCOL_VERSION) {
      sendError(
        connection,
        "PROTOCOL_MISMATCH",
        `server speaks protocol ${PROTOCOL_VERSION}`,
      );
      closeSocket(connection, 4002, "protocol mismatch");
      return;
    }

    const taken = store.takenIdentities(message.world);
    const presence = createPresence(connection.id, taken);
    const session: WorldSession = {
      clientId: connection.id,
      name: presence.name,
      color: presence.color,
      send: (outbound) => send(connection, outbound),
    };

    const result = store.join(message.world, session, message.protocolVersion);
    if (!result.ok) {
      sendError(connection, result.error.code, result.error.message, {
        retryAfterMs: result.error.retryAfterMs,
        strokeId: result.error.strokeId,
      });
      if (result.error.code === "WORLD_FULL" || result.error.code === "SERVER_FULL") {
        closeSocket(connection, 4001, "world full");
      } else if (result.error.code === "PROTOCOL_MISMATCH") {
        closeSocket(connection, 4002, "protocol mismatch");
      }
      return;
    }

    connection.session = session;
    connection.world = message.world;
    connection.joined = true;
    if (connection.joinTimer) {
      clearTimeout(connection.joinTimer);
      connection.joinTimer = null;
    }

    send(connection, result.welcome);
    store.announceJoin(message.world, connection.id);
  }

  function handleMessage(connection: Connection, message: ClientMessage): void {
    if (!connection.joined || !connection.world || !connection.session) {
      if (message.type === "join") {
        handleJoin(connection, message);
        return;
      }
      sendError(connection, "JOIN_REQUIRED", "join a world first");
      return;
    }

    const world = connection.world;
    const clientId = connection.session.clientId;

    switch (message.type) {
      case "join":
        sendError(connection, "BAD_MESSAGE", "already joined a world");
        return;
      case "stroke:start":
        applyResult(connection, store.startStroke(world, clientId, message));
        return;
      case "stroke:append":
        applyResult(connection, store.appendStroke(world, clientId, message));
        return;
      case "stroke:end":
        applyResult(connection, store.endStroke(world, clientId, message));
        return;
      case "stroke:undo":
        applyResult(connection, store.undoStroke(world, clientId, message));
        return;
      case "cursor":
        applyResult(connection, store.updateCursor(world, clientId, message.x, message.y));
        return;
      case "world:clear":
        applyResult(connection, store.clearWorld(world, clientId));
        return;
      default:
        return;
    }
  }

  function handleIncoming(
    connection: Connection,
    data: RawData,
    isBinary: boolean,
  ): void {
    if (connection.closing) return;
    const now = Date.now();

    if (!connection.bucket.take(1, now)) {
      sendError(connection, "RATE_LIMITED", "too many messages", {
        retryAfterMs: connection.bucket.retryAfterMs(1, now),
      });
      connection.rateStrikes += 1;
      if (connection.rateStrikes >= MAX_RATE_STRIKES) {
        closeSocket(connection, 4008, "rate limit abuse");
      }
      return;
    }

    if (isBinary) {
      protocolViolation(connection, "binary messages are not supported");
      return;
    }

    const raw = textFromRawData(data);
    if (Buffer.byteLength(raw, "utf8") > LIMITS.maxMessageBytes) {
      protocolViolation(connection, "message too large");
      return;
    }

    const parsed = parseClientMessage(raw);
    if (!parsed.ok) {
      sendError(connection, parsed.error, parsed.message, {
        strokeId: parsed.strokeId,
      });
      if (parsed.error === "BAD_MESSAGE") {
        connection.protocolStrikes += 1;
        if (connection.protocolStrikes >= MAX_PROTOCOL_STRIKES) {
          closeSocket(connection, 4000, "protocol abuse");
        }
      }
      return;
    }

    handleMessage(connection, parsed.message);
  }

  wss.on("connection", (ws: WebSocket) => {
    const id = randomUUID();
    const connection: Connection = {
      id,
      ws,
      bucket: new TokenBucket(),
      world: null,
      session: null,
      joined: false,
      isAlive: true,
      joinTimer: null,
      protocolStrikes: 0,
      rateStrikes: 0,
      closing: false,
    };
    connections.set(id, connection);

    ws.on("pong", () => {
      connection.isAlive = true;
    });

    ws.on("message", (data, isBinary) => {
      handleIncoming(connection, data, isBinary);
    });

    ws.on("close", () => {
      if (connection.joinTimer) {
        clearTimeout(connection.joinTimer);
        connection.joinTimer = null;
      }
      connections.delete(connection.id);
      if (connection.world && connection.session) {
        store.leave(connection.world, connection.session.clientId);
        connection.world = null;
        connection.session = null;
      }
      connection.joined = false;
    });

    ws.on("error", () => {
      // ws always emits close after error; cleanup happens there.
    });

    connection.joinTimer = setTimeout(() => {
      if (connection.joined || connection.closing) return;
      sendError(connection, "JOIN_REQUIRED", "join timed out");
      closeSocket(connection, 4003, "join timeout");
    }, joinTimeoutMs);
  });

  const heartbeat = setInterval(() => {
    for (const connection of connections.values()) {
      if (connection.ws.readyState !== WebSocket.OPEN) continue;
      if (connection.ws.bufferedAmount > MAX_BUFFERED_BYTES) {
        closeSocket(connection, 1013, "slow consumer");
        continue;
      }
      if (!connection.isAlive) {
        connection.ws.terminate();
        continue;
      }
      connection.isAlive = false;
      try {
        connection.ws.ping();
      } catch {
        connection.ws.terminate();
      }
    }
  }, heartbeatIntervalMs);
  heartbeat.unref?.();

  await new Promise<void>((resolveListen, rejectListen) => {
    httpServer.once("error", rejectListen);
    httpServer.listen(port, host, () => {
      httpServer.off("error", rejectListen);
      resolveListen();
    });
  });

  const address = httpServer.address();
  const actualPort =
    typeof address === "object" && address !== null ? address.port : port;

  let closingPromise: Promise<void> | null = null;
  const close = (): Promise<void> => {
    if (closingPromise) return closingPromise;
    closingPromise = (async () => {
      clearInterval(heartbeat);

      for (const connection of connections.values()) {
        connection.closing = true;
        if (connection.joinTimer) {
          clearTimeout(connection.joinTimer);
          connection.joinTimer = null;
        }
        try {
          connection.ws.close(1001, "server shutting down");
        } catch {
          connection.ws.terminate();
        }
      }

      await delay(150);
      for (const connection of connections.values()) {
        try {
          connection.ws.terminate();
        } catch {
          // Already closed.
        }
      }

      await new Promise<void>((resolveWss) => {
        wss.close(() => resolveWss());
      });
      const httpClosed = new Promise<void>((resolveHttp) => {
        httpServer.close(() => resolveHttp());
      });
      httpServer.closeAllConnections();
      await httpClosed;
      await snapshot?.flush();
    })();
    return closingPromise;
  };

  return {
    port: actualPort,
    httpServer,
    wss,
    store,
    snapshot,
    close,
  };
}

async function main(): Promise<void> {
  try {
    process.loadEnvFile();
  } catch {
    // .env is optional; defaults and process env are enough.
  }

  const running = await startServer();
  console.log(`[ws] listening on ws://localhost:${running.port}/ws`);
  console.log(`[ws] health on http://localhost:${running.port}/healthz`);

  let stopping = false;
  const stop = async (signal: string): Promise<void> => {
    if (stopping) return;
    stopping = true;
    console.log(`[ws] ${signal} received, flushing snapshot...`);
    try {
      await running.close();
    } catch (error) {
      console.error("[ws] shutdown error", error);
      process.exitCode = 1;
    }
    process.exit(process.exitCode ?? 0);
  };

  process.once("SIGINT", () => {
    void stop("SIGINT");
  });
  process.once("SIGTERM", () => {
    void stop("SIGTERM");
  });
}

const entry = (process.argv[1] ?? "").replace(/\\/g, "/");
if (/\/server\/index\.(ts|js)$/.test(entry)) {
  void main().catch((error) => {
    console.error("[ws] failed to start", error);
    process.exit(1);
  });
}
