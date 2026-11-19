import {
  ERASER_COLOR,
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
} from "../shared/world.js";
import {
  PROTOCOL_VERSION,
  type ErrorCode,
  type ServerMessage,
  type StrokeAppendMessage,
  type StrokeEndMessage,
  type StrokeStartMessage,
  type StrokeUndoMessage,
  type WelcomeMessage,
} from "../shared/protocol.js";

export const CLEAR_WORLD_COOLDOWN_MS = 3_000;
export const CLEAR_CLIENT_COOLDOWN_MS = 10_000;

export interface WorldSession {
  clientId: string;
  name: string;
  color: string;
  send(message: ServerMessage): void;
}

export interface WorldFailure {
  code: ErrorCode;
  message?: string;
  retryAfterMs?: number;
  strokeId?: string;
}

export type WorldResult =
  | { ok: true; warning?: WorldFailure }
  | { ok: false; error: WorldFailure };

export type JoinResult =
  | { ok: true; welcome: WelcomeMessage }
  | { ok: false; error: WorldFailure };

export interface PersistedWorld {
  epoch: number;
  lastClearAt: number;
  strokes: Stroke[];
}

export interface WorldStoreSnapshot {
  worlds: Record<string, PersistedWorld>;
}

interface Member {
  session: WorldSession;
  presence: Presence;
  lastClearAt: number;
}

interface WorldState {
  slug: string;
  members: Map<string, Member>;
  strokes: Map<string, Stroke>;
  totalPoints: number;
  epoch: number;
  lastClearAt: number;
}

function failure(
  code: ErrorCode,
  message?: string,
  extra: Omit<WorldFailure, "code" | "message"> = {},
): WorldFailure {
  return { code, ...(message ? { message } : {}), ...extra };
}

function failed(
  code: ErrorCode,
  message?: string,
  extra: Omit<WorldFailure, "code" | "message"> = {},
): WorldResult {
  return { ok: false, error: failure(code, message, extra) };
}

function clonePresence(presence: Presence): Presence {
  return {
    clientId: presence.clientId,
    name: presence.name,
    color: presence.color,
    cursor: presence.cursor ? [presence.cursor[0], presence.cursor[1]] : null,
  };
}

function copyStroke(stroke: Stroke): Stroke {
  return {
    ...stroke,
    points: stroke.points.map(([x, y]) => [x, y] as Point),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readPersistedStroke(value: unknown): Stroke | null {
  const record = asRecord(value);
  if (!record) return null;

  const { id, authorId, tool, color, width, createdAt } = record;
  if (!isStrokeId(id) || !isStrokeId(authorId)) return null;
  if (!isTool(tool) || !isHexColor(color) || !isStrokeWidth(width)) return null;
  if (typeof createdAt !== "number" || !Number.isFinite(createdAt)) return null;
  if (!Array.isArray(record.points)) return null;

  const points: Point[] = [];
  for (const candidate of record.points) {
    if (!isPoint(candidate)) return null;
    points.push([candidate[0], candidate[1]]);
  }
  if (points.length === 0) return null;

  return {
    id,
    authorId,
    tool,
    color: tool === "eraser" ? ERASER_COLOR : color,
    width,
    points,
    createdAt,
  };
}

/**
 * World state is server-authoritative. Every outbound drawing/presence event is
 * broadcast to every member of the world in insertion order, including the
 * sender, so all clients observe one ordering.
 */
export class WorldStore {
  readonly limits: WorldLimits;
  onChange: (() => void) | null = null;
  private readonly worlds = new Map<string, WorldState>();

  constructor(limits: WorldLimits = LIMITS) {
    this.limits = limits;
  }

  takenIdentities(world: string): { names: Set<string>; colors: Set<string> } {
    const state = this.worlds.get(world);
    const names = new Set<string>();
    const colors = new Set<string>();
    if (state) {
      for (const member of state.members.values()) {
        names.add(member.presence.name);
        colors.add(member.presence.color);
      }
    }
    return { names, colors };
  }

  join(world: string, session: WorldSession, protocolVersion: number): JoinResult {
    if (protocolVersion !== PROTOCOL_VERSION) {
      return {
        ok: false,
        error: failure("PROTOCOL_MISMATCH", "protocol version mismatch"),
      };
    }
    if (!isValidWorldSlug(world)) {
      return { ok: false, error: failure("BAD_MESSAGE", "invalid world slug") };
    }

    const state = this.getOrCreate(world);
    if (state.members.has(session.clientId)) {
      return { ok: false, error: failure("BAD_MESSAGE", "already joined this world") };
    }
    if (state.members.size >= this.limits.maxClientsPerWorld) {
      return {
        ok: false,
        error: failure("WORLD_FULL", "world has reached its client limit"),
      };
    }

    const presence: Presence = {
      clientId: session.clientId,
      name: session.name,
      color: session.color,
      cursor: null,
    };
    state.members.set(session.clientId, {
      session,
      presence,
      lastClearAt: 0,
    });

    const users = [...state.members.values()]
      .filter((member) => member.session.clientId !== session.clientId)
      .map((member) => clonePresence(member.presence));

    return {
      ok: true,
      welcome: {
        type: "welcome",
        protocolVersion: PROTOCOL_VERSION,
        world,
        self: clonePresence(presence),
        users,
        epoch: state.epoch,
        strokes: [...state.strokes.values()].map(copyStroke),
        limits: { ...this.limits },
      },
    };
  }

  /**
   * Broadcasts the joining user to everyone, including the joiner. The caller
   * sends welcome first, so the joiner always has its self snapshot.
   */
  announceJoin(world: string, clientId: string): void {
    const state = this.worlds.get(world);
    const member = state?.members.get(clientId);
    if (!state || !member) return;
    this.broadcast(state, {
      type: "presence:join",
      user: clonePresence(member.presence),
    });
  }

  leave(world: string, clientId: string): boolean {
    const state = this.worlds.get(world);
    const member = state?.members.get(clientId);
    if (!state || !member) return false;

    state.members.delete(clientId);
    this.broadcast(state, { type: "presence:leave", clientId });

    if (state.members.size === 0 && state.strokes.size === 0) {
      this.worlds.delete(world);
    }
    return true;
  }

  startStroke(world: string, clientId: string, message: StrokeStartMessage): WorldResult {
    const found = this.findMember(world, clientId);
    if (!found) return failed("JOIN_REQUIRED", "join a world first");
    const { state } = found;

    if (state.strokes.has(message.strokeId)) {
      return failed("BAD_MESSAGE", "stroke id already exists", {
        strokeId: message.strokeId,
      });
    }
    if (!isTool(message.tool) || !isHexColor(message.color)) {
      return failed("BAD_MESSAGE", "invalid stroke metadata");
    }
    if (!isStrokeWidth(message.width) || !isPoint(message.point)) {
      return failed("BAD_MESSAGE", "invalid stroke geometry");
    }
    if (state.strokes.size >= this.limits.maxStrokesPerWorld) {
      return failed("STROKE_LIMIT", "world stroke limit reached", {
        strokeId: message.strokeId,
      });
    }
    if (state.totalPoints >= this.limits.maxPointsPerWorld) {
      return failed("STROKE_LIMIT", "world point limit reached", {
        strokeId: message.strokeId,
      });
    }

    const stroke: Stroke = {
      id: message.strokeId,
      authorId: clientId,
      tool: message.tool,
      color: message.tool === "eraser" ? ERASER_COLOR : message.color,
      width: message.width,
      points: [[message.point[0], message.point[1]]],
      createdAt: Date.now(),
    };

    state.strokes.set(stroke.id, stroke);
    state.totalPoints += 1;
    this.broadcast(state, { type: "stroke:start", stroke: copyStroke(stroke) });
    this.touch();
    return { ok: true };
  }

  appendStroke(world: string, clientId: string, message: StrokeAppendMessage): WorldResult {
    const found = this.findMember(world, clientId);
    if (!found) return failed("JOIN_REQUIRED", "join a world first");
    const { state } = found;

    const stroke = state.strokes.get(message.strokeId);
    if (!stroke) {
      return failed("STROKE_NOT_FOUND", "stroke not found", {
        strokeId: message.strokeId,
      });
    }
    if (stroke.authorId !== clientId) {
      return failed("NOT_AUTHORIZED", "only the stroke author can edit it", {
        strokeId: message.strokeId,
      });
    }
    if (message.points.length === 0) {
      return failed("BAD_MESSAGE", "no points supplied", { strokeId: message.strokeId });
    }
    if (message.points.length > this.limits.maxPointsPerAppend) {
      return failed(
        "STROKE_LIMIT",
        `at most ${this.limits.maxPointsPerAppend} points per append`,
        { strokeId: message.strokeId },
      );
    }
    for (const point of message.points) {
      if (!isPoint(point)) {
        return failed("BAD_MESSAGE", "invalid point", { strokeId: message.strokeId });
      }
    }

    const room = Math.min(
      this.limits.maxPointsPerStroke - stroke.points.length,
      this.limits.maxPointsPerWorld - state.totalPoints,
    );
    if (room <= 0) {
      return failed("STROKE_LIMIT", "stroke or world point limit reached", {
        strokeId: message.strokeId,
      });
    }

    const accepted = message.points
      .slice(0, room)
      .map(([x, y]) => [x, y] as Point);
    stroke.points.push(...accepted);
    state.totalPoints += accepted.length;
    this.broadcast(state, {
      type: "stroke:append",
      strokeId: stroke.id,
      authorId: clientId,
      points: accepted.map(([x, y]) => [x, y] as Point),
    });
    this.touch();

    if (accepted.length < message.points.length) {
      return {
        ok: true,
        warning: failure("STROKE_LIMIT", "append truncated at the point limit", {
          strokeId: message.strokeId,
        }),
      };
    }
    return { ok: true };
  }

  endStroke(world: string, clientId: string, message: StrokeEndMessage): WorldResult {
    const found = this.findMember(world, clientId);
    if (!found) return failed("JOIN_REQUIRED", "join a world first");
    const { state } = found;

    const stroke = state.strokes.get(message.strokeId);
    if (!stroke) {
      return failed("STROKE_NOT_FOUND", "stroke not found", {
        strokeId: message.strokeId,
      });
    }
    if (stroke.authorId !== clientId) {
      return failed("NOT_AUTHORIZED", "only the stroke author can end it", {
        strokeId: message.strokeId,
      });
    }

    this.broadcast(state, {
      type: "stroke:end",
      strokeId: stroke.id,
      authorId: clientId,
    });
    return { ok: true };
  }

  undoStroke(world: string, clientId: string, message: StrokeUndoMessage): WorldResult {
    const found = this.findMember(world, clientId);
    if (!found) return failed("JOIN_REQUIRED", "join a world first");
    const { state } = found;

    const stroke = state.strokes.get(message.strokeId);
    if (!stroke) {
      return failed("STROKE_NOT_FOUND", "stroke not found", {
        strokeId: message.strokeId,
      });
    }
    if (stroke.authorId !== clientId) {
      return failed("NOT_AUTHORIZED", "only the stroke author can undo it", {
        strokeId: message.strokeId,
      });
    }

    state.strokes.delete(stroke.id);
    state.totalPoints -= stroke.points.length;
    this.broadcast(state, {
      type: "stroke:remove",
      strokeId: stroke.id,
      reason: "undo",
    });
    this.touch();
    return { ok: true };
  }

  updateCursor(world: string, clientId: string, x: number, y: number): WorldResult {
    const found = this.findMember(world, clientId);
    if (!found) return failed("JOIN_REQUIRED", "join a world first");
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      x < 0 ||
      x > WORLD_SIZE ||
      y < 0 ||
      y > WORLD_SIZE
    ) {
      return failed("BAD_MESSAGE", "cursor coordinates are out of bounds");
    }

    found.member.presence.cursor = [x, y];
    this.broadcast(found.state, {
      type: "cursor",
      clientId,
      x,
      y,
    });
    return { ok: true };
  }

  clearWorld(world: string, clientId: string): WorldResult {
    const found = this.findMember(world, clientId);
    if (!found) return failed("JOIN_REQUIRED", "join a world first");
    const { state, member } = found;

    const now = Date.now();
    const remaining = Math.max(
      state.lastClearAt + CLEAR_WORLD_COOLDOWN_MS - now,
      member.lastClearAt + CLEAR_CLIENT_COOLDOWN_MS - now,
    );
    if (remaining > 0) {
      return failed("CLEAR_COOLDOWN", "clear is cooling down", {
        retryAfterMs: Math.ceil(remaining),
      });
    }

    state.strokes.clear();
    state.totalPoints = 0;
    state.epoch += 1;
    state.lastClearAt = now;
    member.lastClearAt = now;

    this.broadcast(state, {
      type: "world:cleared",
      epoch: state.epoch,
      by: clientId,
      at: now,
    });
    this.touch();
    return { ok: true };
  }

  snapshot(): WorldStoreSnapshot {
    const worlds: Record<string, PersistedWorld> = {};
    for (const [slug, state] of this.worlds) {
      if (state.strokes.size === 0) continue;
      worlds[slug] = {
        epoch: state.epoch,
        lastClearAt: state.lastClearAt,
        strokes: [...state.strokes.values()].map(copyStroke),
      };
    }
    return { worlds };
  }

  /**
   * Tolerant restore used once at boot. Invalid worlds/strokes are skipped and
   * every cap is re-applied before the data becomes live.
   */
  restore(snapshot: unknown): number {
    const root = asRecord(snapshot);
    const rawWorlds = root ? asRecord(root.worlds) : null;
    if (!rawWorlds) return 0;

    let loaded = 0;
    for (const [slug, rawWorld] of Object.entries(rawWorlds)) {
      if (!isValidWorldSlug(slug)) continue;
      const world = asRecord(rawWorld);
      if (!world || !Array.isArray(world.strokes)) continue;

      const strokes = new Map<string, Stroke>();
      let totalPoints = 0;
      for (const rawStroke of world.strokes) {
        if (strokes.size >= this.limits.maxStrokesPerWorld) break;
        if (totalPoints >= this.limits.maxPointsPerWorld) break;

        const stroke = readPersistedStroke(rawStroke);
        if (!stroke || strokes.has(stroke.id)) continue;

        const room = Math.min(
          this.limits.maxPointsPerStroke,
          this.limits.maxPointsPerWorld - totalPoints,
        );
        if (room <= 0) break;
        if (stroke.points.length > room) {
          stroke.points = stroke.points.slice(0, room);
        }
        strokes.set(stroke.id, stroke);
        totalPoints += stroke.points.length;
      }

      if (strokes.size === 0) continue;

      const epoch =
        typeof world.epoch === "number" &&
        Number.isInteger(world.epoch) &&
        world.epoch >= 0
          ? world.epoch
          : 0;
      const lastClearAt =
        typeof world.lastClearAt === "number" &&
        Number.isFinite(world.lastClearAt) &&
        world.lastClearAt >= 0
          ? world.lastClearAt
          : 0;

      this.worlds.set(slug, {
        slug,
        members: new Map(),
        strokes,
        totalPoints,
        epoch,
        lastClearAt,
      });
      loaded += 1;
    }

    return loaded;
  }

  private getOrCreate(world: string): WorldState {
    const existing = this.worlds.get(world);
    if (existing) return existing;

    const state: WorldState = {
      slug: world,
      members: new Map(),
      strokes: new Map(),
      totalPoints: 0,
      epoch: 0,
      lastClearAt: 0,
    };
    this.worlds.set(world, state);
    return state;
  }

  private findMember(
    world: string,
    clientId: string,
  ): { state: WorldState; member: Member } | null {
    const state = this.worlds.get(world);
    const member = state?.members.get(clientId);
    if (!state || !member) return null;
    return { state, member };
  }

  private broadcast(state: WorldState, message: ServerMessage): void {
    for (const member of state.members.values()) {
      member.session.send(message);
    }
  }

  private touch(): void {
    this.onChange?.();
  }
}
