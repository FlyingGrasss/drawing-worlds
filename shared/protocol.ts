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
  type Tool,
  type WorldLimits,
} from "./world";

export const PROTOCOL_VERSION = 1;

export interface JoinMessage {
  type: "join";
  protocolVersion: number;
  world: string;
}

export interface StrokeStartMessage {
  type: "stroke:start";
  strokeId: string;
  tool: Tool;
  color: string;
  width: number;
  point: Point;
}

export interface StrokeAppendMessage {
  type: "stroke:append";
  strokeId: string;
  points: Point[];
}

export interface StrokeEndMessage {
  type: "stroke:end";
  strokeId: string;
}

export interface StrokeUndoMessage {
  type: "stroke:undo";
  strokeId: string;
}

export interface CursorMessage {
  type: "cursor";
  x: number;
  y: number;
}

export interface WorldClearMessage {
  type: "world:clear";
}

export type ClientMessage =
  | JoinMessage
  | StrokeStartMessage
  | StrokeAppendMessage
  | StrokeEndMessage
  | StrokeUndoMessage
  | CursorMessage
  | WorldClearMessage;

export interface WelcomeMessage {
  type: "welcome";
  protocolVersion: number;
  world: string;
  self: Presence;
  users: Presence[];
  epoch: number;
  strokes: Stroke[];
  limits: WorldLimits;
}

export interface PresenceJoinEvent {
  type: "presence:join";
  user: Presence;
}

export interface PresenceLeaveEvent {
  type: "presence:leave";
  clientId: string;
}

export interface StrokeStartEvent {
  type: "stroke:start";
  stroke: Stroke;
}

export interface StrokeAppendEvent {
  type: "stroke:append";
  strokeId: string;
  authorId: string;
  points: Point[];
}

export interface StrokeEndEvent {
  type: "stroke:end";
  strokeId: string;
  authorId: string;
}

export interface StrokeRemoveEvent {
  type: "stroke:remove";
  strokeId: string;
  reason: "undo";
}

export interface WorldClearedEvent {
  type: "world:cleared";
  epoch: number;
  by: string;
  at: number;
}

export interface CursorEvent {
  type: "cursor";
  clientId: string;
  x: number;
  y: number;
}

export type ErrorCode =
  | "BAD_MESSAGE"
  | "JOIN_REQUIRED"
  | "PROTOCOL_MISMATCH"
  | "WORLD_FULL"
  | "SERVER_FULL"
  | "WORLD_LIMIT"
  | "STROKE_LIMIT"
  | "NOT_AUTHORIZED"
  | "RATE_LIMITED"
  | "CLEAR_COOLDOWN"
  | "STROKE_NOT_FOUND"
  | "SERVER_ERROR";

export interface ErrorMessage {
  type: "error";
  code: ErrorCode;
  message?: string;
  retryAfterMs?: number;
  strokeId?: string;
}

export type ServerMessage =
  | WelcomeMessage
  | PresenceJoinEvent
  | PresenceLeaveEvent
  | StrokeStartEvent
  | StrokeAppendEvent
  | StrokeEndEvent
  | StrokeRemoveEvent
  | WorldClearedEvent
  | CursorEvent
  | ErrorMessage;

export type ClientParseResult =
  | { ok: true; message: ClientMessage }
  | { ok: false; error: ErrorCode; message: string; strokeId?: string };

const encoder = new TextEncoder();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(error: ErrorCode, message: string, strokeId?: string): ClientParseResult {
  return { ok: false, error, message, ...(strokeId ? { strokeId } : {}) };
}

function readStrokeId(value: unknown): string | null {
  return isStrokeId(value) ? value : null;
}

function readPoint(value: unknown): Point | null {
  return isPoint(value) ? [value[0], value[1]] : null;
}

function readPoints(value: unknown): Point[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (value.length > LIMITS.maxPointsPerAppend) return null;
  const points: Point[] = [];
  for (const candidate of value) {
    if (!isPoint(candidate)) return null;
    points.push([candidate[0], candidate[1]]);
  }
  return points;
}

/**
 * Safely parses one client frame. Unknown/malformed payloads never throw.
 */
export function parseClientMessage(raw: string): ClientParseResult {
  if (typeof raw !== "string" || raw.length === 0) {
    return fail("BAD_MESSAGE", "empty message");
  }
  if (encoder.encode(raw).byteLength > LIMITS.maxMessageBytes) {
    return fail("BAD_MESSAGE", "message too large");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fail("BAD_MESSAGE", "invalid JSON");
  }

  if (!isRecord(parsed)) {
    return fail("BAD_MESSAGE", "message must be an object");
  }

  const type = parsed.type;
  if (typeof type !== "string") {
    return fail("BAD_MESSAGE", "message type is required");
  }

  switch (type) {
    case "join": {
      const version = parsed.protocolVersion;
      if (typeof version !== "number" || !Number.isInteger(version)) {
        return fail("BAD_MESSAGE", "protocolVersion must be an integer");
      }
      if (!isValidWorldSlug(parsed.world)) {
        return fail("BAD_MESSAGE", "world must be a lowercase slug of 1-40 characters");
      }
      return {
        ok: true,
        message: { type: "join", protocolVersion: version, world: parsed.world },
      };
    }

    case "stroke:start": {
      const strokeId = readStrokeId(parsed.strokeId);
      const tool = isTool(parsed.tool) ? parsed.tool : null;
      const color = isHexColor(parsed.color) ? parsed.color : null;
      const width = isStrokeWidth(parsed.width) ? parsed.width : null;
      const point = readPoint(parsed.point);

      if (!strokeId) return fail("BAD_MESSAGE", "invalid strokeId");
      if (!tool) return fail("BAD_MESSAGE", "invalid tool");
      if (!color) return fail("BAD_MESSAGE", "invalid color");
      if (!width) return fail("BAD_MESSAGE", "invalid stroke width");
      if (!point) return fail("BAD_MESSAGE", "invalid point");
      return {
        ok: true,
        message: { type: "stroke:start", strokeId, tool, color, width, point },
      };
    }

    case "stroke:append": {
      const strokeId = readStrokeId(parsed.strokeId);
      if (!strokeId) return fail("BAD_MESSAGE", "invalid strokeId");
      if (!Array.isArray(parsed.points) || parsed.points.length === 0) {
        return fail("BAD_MESSAGE", "points must be a non-empty array", strokeId);
      }
      if (parsed.points.length > LIMITS.maxPointsPerAppend) {
        return fail(
          "STROKE_LIMIT",
          `at most ${LIMITS.maxPointsPerAppend} points can be appended at once`,
          strokeId,
        );
      }
      const points = readPoints(parsed.points);
      if (!points) return fail("BAD_MESSAGE", "invalid point", strokeId);
      return { ok: true, message: { type: "stroke:append", strokeId, points } };
    }

    case "stroke:end": {
      const strokeId = readStrokeId(parsed.strokeId);
      if (!strokeId) return fail("BAD_MESSAGE", "invalid strokeId");
      return { ok: true, message: { type: "stroke:end", strokeId } };
    }

    case "stroke:undo": {
      const strokeId = readStrokeId(parsed.strokeId);
      if (!strokeId) return fail("BAD_MESSAGE", "invalid strokeId");
      return { ok: true, message: { type: "stroke:undo", strokeId } };
    }

    case "cursor": {
      const x = parsed.x;
      const y = parsed.y;
      if (
        typeof x !== "number" ||
        !Number.isFinite(x) ||
        x < 0 ||
        x > WORLD_SIZE ||
        typeof y !== "number" ||
        !Number.isFinite(y) ||
        y < 0 ||
        y > WORLD_SIZE
      ) {
        return fail("BAD_MESSAGE", "cursor coordinates are out of bounds");
      }
      return { ok: true, message: { type: "cursor", x, y } };
    }

    case "world:clear":
      return { ok: true, message: { type: "world:clear" } };

    default:
      return fail("BAD_MESSAGE", "unknown message type");
  }
}

export function encodeServerMessage(message: ServerMessage): string {
  return JSON.stringify(message);
}
