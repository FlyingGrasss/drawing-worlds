import {
  PROTOCOL_VERSION,
  type ClientMessage,
  type CursorEvent,
  type ErrorCode,
  type ErrorMessage,
  type PresenceJoinEvent,
  type PresenceLeaveEvent,
  type ServerMessage,
  type StrokeAppendEvent,
  type StrokeEndEvent,
  type StrokeRemoveEvent,
  type StrokeStartEvent,
  type WelcomeMessage,
  type WorldClearedEvent,
} from "@shared/protocol";
import {
  LIMITS,
  WORLD_SIZE,
  isHexColor,
  isPoint,
  isStrokeId,
  isStrokeWidth,
  isTool,
  isValidWorldSlug,
  type Point,
  type Presence,
  type Stroke,
  type WorldLimits,
} from "@shared/world";

const DEFAULT_WS_PORT = 4100;
const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 8_000;

const TERMINAL_ERROR_CODES = new Set<ErrorCode>([
  "WORLD_FULL",
  "PROTOCOL_MISMATCH",
]);
const TERMINAL_CLOSE_CODES = new Set([4001, 4002]);

const ERROR_CODES = new Set<string>([
  "BAD_MESSAGE",
  "JOIN_REQUIRED",
  "PROTOCOL_MISMATCH",
  "WORLD_FULL",
  "SERVER_FULL",
  "WORLD_LIMIT",
  "STROKE_LIMIT",
  "NOT_AUTHORIZED",
  "RATE_LIMITED",
  "CLEAR_COOLDOWN",
  "STROKE_NOT_FOUND",
  "SERVER_ERROR",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readClientId(value: unknown): string | null {
  return isStrokeId(value) ? value : null;
}

function readPresence(value: unknown): Presence | null {
  if (!isRecord(value)) return null;

  const clientId = readClientId(value.clientId);
  if (!clientId) return null;
  if (typeof value.name !== "string" || value.name.length === 0) return null;
  if (!isHexColor(value.color)) return null;

  let cursor: Point | null = null;
  if (value.cursor !== null) {
    if (!isPoint(value.cursor)) return null;
    cursor = [value.cursor[0], value.cursor[1]];
  }

  return { clientId, name: value.name, color: value.color, cursor };
}

function readPoints(value: unknown, maxPoints: number): Point[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (value.length > maxPoints) return null;

  const points: Point[] = [];
  for (const candidate of value) {
    if (!isPoint(candidate)) return null;
    points.push([candidate[0], candidate[1]]);
  }
  return points;
}

function readStroke(value: unknown): Stroke | null {
  if (!isRecord(value)) return null;

  const id = readClientId(value.id);
  const authorId = readClientId(value.authorId);
  if (!id || !authorId) return null;
  if (!isTool(value.tool) || !isHexColor(value.color)) return null;
  if (!isStrokeWidth(value.width)) return null;
  if (typeof value.createdAt !== "number" || !Number.isFinite(value.createdAt)) {
    return null;
  }

  const points = readPoints(value.points, Number.POSITIVE_INFINITY);
  if (!points) return null;

  return {
    id,
    authorId,
    tool: value.tool,
    color: value.color,
    width: value.width,
    points,
    createdAt: value.createdAt,
  };
}

function readLimits(value: unknown): WorldLimits | null {
  if (!isRecord(value)) return null;

  const keys = [
    "maxClientsPerWorld",
    "maxStrokesPerWorld",
    "maxPointsPerStroke",
    "maxPointsPerWorld",
    "maxPointsPerAppend",
    "maxMessageBytes",
  ] as const;

  const limits = {} as WorldLimits;
  for (const key of keys) {
    const candidate = value[key];
    if (
      typeof candidate !== "number" ||
      !Number.isFinite(candidate) ||
      candidate < 0
    ) {
      return null;
    }
    limits[key] = candidate;
  }

  return limits;
}

/**
 * Defensive parser for server frames. The shared package exposes the client
 * parser and primitive guards only, so server frames are validated here with
 * those same guards before they reach React.
 */
export function parseServerMessage(raw: string): ServerMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(parsed) || typeof parsed.type !== "string") return null;

  switch (parsed.type) {
    case "welcome": {
      if (
        typeof parsed.protocolVersion !== "number" ||
        !Number.isInteger(parsed.protocolVersion)
      ) {
        return null;
      }
      if (!isValidWorldSlug(parsed.world)) return null;

      const self = readPresence(parsed.self);
      if (!self) return null;
      if (!Array.isArray(parsed.users)) return null;

      const users: Presence[] = [];
      for (const candidate of parsed.users) {
        const user = readPresence(candidate);
        if (!user) return null;
        users.push(user);
      }

      if (
        typeof parsed.epoch !== "number" ||
        !Number.isInteger(parsed.epoch) ||
        parsed.epoch < 0
      ) {
        return null;
      }
      if (!Array.isArray(parsed.strokes)) return null;

      const strokes: Stroke[] = [];
      for (const candidate of parsed.strokes) {
        const stroke = readStroke(candidate);
        if (!stroke) return null;
        strokes.push(stroke);
      }

      const limits = readLimits(parsed.limits);
      if (!limits) return null;

      const welcome: WelcomeMessage = {
        type: "welcome",
        protocolVersion: parsed.protocolVersion,
        world: parsed.world,
        self,
        users,
        epoch: parsed.epoch,
        strokes,
        limits,
      };
      return welcome;
    }

    case "presence:join": {
      const user = readPresence(parsed.user);
      if (!user) return null;
      const event: PresenceJoinEvent = { type: "presence:join", user };
      return event;
    }

    case "presence:leave": {
      const clientId = readClientId(parsed.clientId);
      if (!clientId) return null;
      const event: PresenceLeaveEvent = { type: "presence:leave", clientId };
      return event;
    }

    case "stroke:start": {
      const stroke = readStroke(parsed.stroke);
      if (!stroke) return null;
      const event: StrokeStartEvent = { type: "stroke:start", stroke };
      return event;
    }

    case "stroke:append": {
      const strokeId = readClientId(parsed.strokeId);
      const authorId = readClientId(parsed.authorId);
      if (!strokeId || !authorId) return null;

      const points = readPoints(parsed.points, LIMITS.maxPointsPerAppend);
      if (!points) return null;

      const event: StrokeAppendEvent = {
        type: "stroke:append",
        strokeId,
        authorId,
        points,
      };
      return event;
    }

    case "stroke:end": {
      const strokeId = readClientId(parsed.strokeId);
      const authorId = readClientId(parsed.authorId);
      if (!strokeId || !authorId) return null;
      const event: StrokeEndEvent = {
        type: "stroke:end",
        strokeId,
        authorId,
      };
      return event;
    }

    case "stroke:remove": {
      const strokeId = readClientId(parsed.strokeId);
      if (!strokeId || parsed.reason !== "undo") return null;
      const event: StrokeRemoveEvent = {
        type: "stroke:remove",
        strokeId,
        reason: "undo",
      };
      return event;
    }

    case "world:cleared": {
      if (
        typeof parsed.epoch !== "number" ||
        !Number.isInteger(parsed.epoch) ||
        parsed.epoch < 0
      ) {
        return null;
      }
      const by = readClientId(parsed.by);
      if (!by) return null;
      if (typeof parsed.at !== "number" || !Number.isFinite(parsed.at)) {
        return null;
      }
      const event: WorldClearedEvent = {
        type: "world:cleared",
        epoch: parsed.epoch,
        by,
        at: parsed.at,
      };
      return event;
    }

    case "cursor": {
      const clientId = readClientId(parsed.clientId);
      if (!clientId) return null;
      if (!isPoint([parsed.x, parsed.y])) return null;
      const event: CursorEvent = {
        type: "cursor",
        clientId,
        x: parsed.x as number,
        y: parsed.y as number,
      };
      return event;
    }

    case "error": {
      if (typeof parsed.code !== "string" || !ERROR_CODES.has(parsed.code)) {
        return null;
      }
      if (
        parsed.message !== undefined &&
        typeof parsed.message !== "string"
      ) {
        return null;
      }
      if (
        parsed.retryAfterMs !== undefined &&
        (typeof parsed.retryAfterMs !== "number" ||
          !Number.isFinite(parsed.retryAfterMs) ||
          parsed.retryAfterMs < 0)
      ) {
        return null;
      }
      if (
        parsed.strokeId !== undefined &&
        !isStrokeId(parsed.strokeId)
      ) {
        return null;
      }

      const event: ErrorMessage = {
        type: "error",
        code: parsed.code as ErrorCode,
        ...(parsed.message !== undefined ? { message: parsed.message } : {}),
        ...(parsed.retryAfterMs !== undefined
          ? { retryAfterMs: parsed.retryAfterMs }
          : {}),
        ...(parsed.strokeId !== undefined
          ? { strokeId: parsed.strokeId }
          : {}),
      };
      return event;
    }

    default:
      return null;
  }
}

export interface WorldSocketCloseInfo {
  code: number;
  reason: string;
  willReconnect: boolean;
  terminal: boolean;
}

export interface WorldSocketEventMap {
  open: undefined;
  close: WorldSocketCloseInfo;
  welcome: WelcomeMessage;
  "presence:join": PresenceJoinEvent;
  "presence:leave": PresenceLeaveEvent;
  "stroke:start": StrokeStartEvent;
  "stroke:append": StrokeAppendEvent;
  "stroke:end": StrokeEndEvent;
  "stroke:remove": StrokeRemoveEvent;
  "world:cleared": WorldClearedEvent;
  cursor: CursorEvent;
  error: ErrorMessage;
}

export function resolveWorldSocketUrl(): string {
  const configured = process.env.NEXT_PUBLIC_WS_URL;
  if (configured) return configured;

  if (typeof window === "undefined") {
    return `ws://localhost:${DEFAULT_WS_PORT}/ws`;
  }

  const hostname = window.location.hostname || "localhost";
  return `ws://${hostname}:${DEFAULT_WS_PORT}/ws`;
}

/**
 * Small typed emitter used by WorldSocket. Listener failures are isolated so
 * one bad callback cannot stop frame delivery.
 */
class WorldSocketEmitter {
  private readonly listeners = new Map<
    keyof WorldSocketEventMap,
    Set<(payload: unknown) => void>
  >();

  on<K extends keyof WorldSocketEventMap>(
    event: K,
    listener: (payload: WorldSocketEventMap[K]) => void,
  ): () => void {
    const wrapped = listener as (payload: unknown) => void;
    let bucket = this.listeners.get(event);
    if (!bucket) {
      bucket = new Set();
      this.listeners.set(event, bucket);
    }
    bucket.add(wrapped);

    return () => {
      bucket?.delete(wrapped);
      if (bucket && bucket.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  off<K extends keyof WorldSocketEventMap>(
    event: K,
    listener: (payload: WorldSocketEventMap[K]) => void,
  ): void {
    const bucket = this.listeners.get(event);
    if (!bucket) return;

    bucket.delete(listener as (payload: unknown) => void);
    if (bucket.size === 0) {
      this.listeners.delete(event);
    }
  }

  protected emit<K extends keyof WorldSocketEventMap>(
    event: K,
    payload: WorldSocketEventMap[K],
  ): void {
    const bucket = this.listeners.get(event);
    if (!bucket) return;

    for (const listener of [...bucket]) {
      try {
        listener(payload);
      } catch (error) {
        console.error("[ws] listener failed", error);
      }
    }
  }
}

/**
 * Browser WebSocket client for one world. Reconnects with exponential backoff
 * and jitter until a terminal world/protocol error arrives.
 */
export class WorldSocket extends WorldSocketEmitter {
  private readonly world: string;
  private readonly url: string;
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private attempt = 0;
  private terminal = false;
  private destroyed = false;

  constructor(world: string, url: string = resolveWorldSocketUrl()) {
    super();
    this.world = world;
    this.url = url;
    this.connect();
  }

  connect(): void {
    if (this.destroyed || this.terminal) return;

    this.clearReconnectTimer();

    const current = this.socket;
    if (
      current &&
      (current.readyState === WebSocket.CONNECTING ||
        current.readyState === WebSocket.OPEN)
    ) {
      return;
    }

    if (typeof WebSocket === "undefined") {
      this.terminal = true;
      this.emit("close", {
        code: 1006,
        reason: "WebSocket is unavailable",
        willReconnect: false,
        terminal: true,
      });
      return;
    }

    let socket: WebSocket;
    try {
      socket = new WebSocket(this.url);
    } catch {
      this.emit("close", {
        code: 1006,
        reason: "WebSocket connection failed",
        willReconnect: true,
        terminal: false,
      });
      this.scheduleReconnect();
      return;
    }

    this.socket = socket;

    socket.onopen = () => {
      if (this.socket !== socket) return;
      this.attempt = 0;

      try {
        socket.send(
          JSON.stringify({
            type: "join",
            protocolVersion: PROTOCOL_VERSION,
            world: this.world,
          } satisfies ClientMessage),
        );
      } catch {
        socket.close();
        return;
      }

      this.emit("open", undefined);
    };

    socket.onmessage = (event) => {
      if (this.socket !== socket) return;
      if (typeof event.data !== "string") return;

      const message = parseServerMessage(event.data);
      if (!message) return;

      if (
        message.type === "error" &&
        TERMINAL_ERROR_CODES.has(message.code)
      ) {
        this.terminal = true;
      }

      this.emitServerMessage(message);
    };

    socket.onerror = () => {
      // Browsers always follow an error with a close event; reconnect there.
    };

    socket.onclose = (event) => {
      if (this.socket !== socket) return;
      this.socket = null;

      if (TERMINAL_CLOSE_CODES.has(event.code)) {
        this.terminal = true;
      }

      const willReconnect = !this.destroyed && !this.terminal;
      this.emit("close", {
        code: event.code,
        reason: event.reason,
        willReconnect,
        terminal: this.terminal,
      });

      if (willReconnect) {
        this.scheduleReconnect();
      }
    };
  }

  send(message: ClientMessage): void {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    try {
      socket.send(JSON.stringify(message));
    } catch {
      // The socket can close between the readyState check and send().
    }
  }

  retry(): void {
    if (this.destroyed) return;

    const current = this.socket;
    if (
      current &&
      (current.readyState === WebSocket.OPEN ||
        current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.terminal = false;
    this.attempt = 0;
    this.socket = null;
    this.clearReconnectTimer();
    this.connect();
  }

  close(): void {
    this.destroyed = true;
    this.clearReconnectTimer();

    const socket = this.socket;
    this.socket = null;
    if (!socket) return;

    if (
      socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING
    ) {
      try {
        socket.close(1000, "client closed");
      } catch {
        // Closing an already-closed socket is safe to ignore.
      }
    }
  }

  private emitServerMessage(message: ServerMessage): void {
    switch (message.type) {
      case "welcome":
        this.emit("welcome", message);
        return;
      case "presence:join":
        this.emit("presence:join", message);
        return;
      case "presence:leave":
        this.emit("presence:leave", message);
        return;
      case "stroke:start":
        this.emit("stroke:start", message);
        return;
      case "stroke:append":
        this.emit("stroke:append", message);
        return;
      case "stroke:end":
        this.emit("stroke:end", message);
        return;
      case "stroke:remove":
        this.emit("stroke:remove", message);
        return;
      case "world:cleared":
        this.emit("world:cleared", message);
        return;
      case "cursor":
        this.emit("cursor", message);
        return;
      case "error":
        this.emit("error", message);
        return;
      default:
        return;
    }
  }

  private scheduleReconnect(): void {
    if (this.destroyed || this.terminal || this.reconnectTimer !== null) {
      return;
    }

    const base = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** this.attempt);
    this.attempt += 1;

    const jitter = Math.random() * Math.min(1_000, base * 0.25);
    const delay = Math.min(RECONNECT_MAX_MS, Math.round(base + jitter));

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer === null) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }
}

export default WorldSocket;
