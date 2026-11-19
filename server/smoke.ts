import assert from "node:assert/strict";
import { WebSocket } from "ws";
import type { Point } from "../shared/world.js";
import {
  PROTOCOL_VERSION,
  type ClientMessage,
  type ServerMessage,
} from "../shared/protocol.js";
import { startServer } from "./index.js";

interface Waiter {
  match: (message: ServerMessage) => boolean;
  resolve: (message: ServerMessage) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

class TestClient {
  private readonly ws: WebSocket;
  private readonly queue: ServerMessage[] = [];
  private readonly waiters: Waiter[] = [];
  private closed = false;

  constructor(
    private readonly label: string,
    url: string,
  ) {
    this.ws = new WebSocket(url, { origin: "http://localhost:3000" });

    this.ws.on("message", (data) => {
      let message: ServerMessage;
      try {
        message = JSON.parse(data.toString()) as ServerMessage;
      } catch {
        return;
      }

      const waiterIndex = this.waiters.findIndex((waiter) => waiter.match(message));
      if (waiterIndex === -1) {
        this.queue.push(message);
        return;
      }

      const [waiter] = this.waiters.splice(waiterIndex, 1);
      if (!waiter) return;
      clearTimeout(waiter.timer);
      waiter.resolve(message);
    });

    this.ws.on("close", () => {
      this.closed = true;
      for (const waiter of this.waiters.splice(0)) {
        clearTimeout(waiter.timer);
        waiter.reject(new Error(`[${this.label}] socket closed while waiting`));
      }
    });

    this.ws.on("error", (error) => {
      for (const waiter of this.waiters.splice(0)) {
        clearTimeout(waiter.timer);
        waiter.reject(error);
      }
    });
  }

  open(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      const onOpen = () => {
        cleanup();
        resolve();
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      const cleanup = () => {
        this.ws.off("open", onOpen);
        this.ws.off("error", onError);
      };

      this.ws.once("open", onOpen);
      this.ws.once("error", onError);
    });
  }

  send(message: ClientMessage): void {
    this.ws.send(JSON.stringify(message));
  }

  sendRaw(raw: string): void {
    this.ws.send(raw);
  }

  waitFor<T extends ServerMessage>(
    match: (message: ServerMessage) => boolean,
    timeoutMs = 4_000,
  ): Promise<T> {
    const queuedIndex = this.queue.findIndex(match);
    if (queuedIndex !== -1) {
      const [queued] = this.queue.splice(queuedIndex, 1);
      return Promise.resolve(queued as T);
    }
    if (this.closed) {
      return Promise.reject(new Error(`[${this.label}] socket is closed`));
    }

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = this.waiters.findIndex((candidate) => candidate.timer === timer);
        if (index !== -1) this.waiters.splice(index, 1);
        const pending = this.queue.map((message) => message.type).join(", ");
        reject(
          new Error(
            `[${this.label}] timed out waiting for a message; queued: ${pending || "none"}`,
          ),
        );
      }, timeoutMs);

      this.waiters.push({
        match,
        resolve: (message) => resolve(message as T),
        reject,
        timer,
      });
    });
  }

  waitForType<T extends ServerMessage["type"]>(
    type: T,
    timeoutMs = 4_000,
  ): Promise<Extract<ServerMessage, { type: T }>> {
    return this.waitFor<Extract<ServerMessage, { type: T }>>(
      (message) => message.type === type,
      timeoutMs,
    );
  }

  close(): Promise<void> {
    if (this.closed || this.ws.readyState === WebSocket.CLOSED) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        this.ws.terminate();
        resolve();
      }, 300);

      this.ws.once("close", () => {
        clearTimeout(timer);
        resolve();
      });
      this.ws.close();
    });
  }
}

async function main(): Promise<void> {
  const running = await startServer({
    port: 0,
    snapshotPath: null,
    dev: true,
    joinTimeoutMs: 5_000,
    heartbeatIntervalMs: 30_000,
  });

  const world = `smoke-${Date.now().toString(36)}`;
  const url = `ws://127.0.0.1:${running.port}/ws`;
  const a = new TestClient("A", url);
  const b = new TestClient("B", url);

  console.log(`[smoke] server ${url} world ${world}`);

  try {
    await Promise.all([a.open(), b.open()]);

    a.send({ type: "join", protocolVersion: PROTOCOL_VERSION, world });
    const welcomeA = await a.waitForType("welcome");
    assert.equal(welcomeA.protocolVersion, PROTOCOL_VERSION);
    assert.equal(welcomeA.world, world);
    assert.equal(welcomeA.epoch, 0);
    assert.equal(welcomeA.strokes.length, 0);
    assert.equal(welcomeA.users.length, 0);
    assert.equal(welcomeA.limits.maxClientsPerWorld, 30);
    assert.equal(welcomeA.limits.maxMessageBytes, 24 * 1024);
    const aId = welcomeA.self.clientId;
    const selfPresenceA = await a.waitForType("presence:join");
    assert.equal(selfPresenceA.user.clientId, aId);
    console.log("[smoke] welcome A with empty strokes");

    b.send({ type: "join", protocolVersion: PROTOCOL_VERSION, world });
    const welcomeB = await b.waitForType("welcome");
    assert.equal(welcomeB.users.length, 1);
    assert.equal(welcomeB.users[0]?.clientId, aId);
    assert.equal(welcomeB.strokes.length, 0);
    const bId = welcomeB.self.clientId;

    const presenceOfBAtA = await a.waitForType("presence:join");
    assert.equal(presenceOfBAtA.user.clientId, bId);
    const selfPresenceB = await b.waitForType("presence:join");
    assert.equal(selfPresenceB.user.clientId, bId);
    console.log("[smoke] presence join delivered to both clients");

    const strokeId = `stroke-${Date.now().toString(36)}`;
    a.send({
      type: "stroke:start",
      strokeId,
      tool: "pen",
      color: "#1c1917",
      width: 4,
      point: [100, 120],
    });
    const startAtB = await b.waitForType("stroke:start");
    const startAtA = await a.waitForType("stroke:start");
    assert.equal(startAtB.stroke.id, strokeId);
    assert.equal(startAtB.stroke.authorId, aId);
    assert.deepEqual(startAtB.stroke.points, [[100, 120]]);
    assert.equal(startAtA.stroke.id, strokeId);
    console.log("[smoke] stroke:start relayed to both");

    const points: Point[] = [
      [110, 130],
      [120, 140],
      [135, 150],
    ];
    a.send({ type: "stroke:append", strokeId, points });
    const appendAtB = await b.waitForType("stroke:append");
    const appendAtA = await a.waitForType("stroke:append");
    assert.equal(appendAtB.strokeId, strokeId);
    assert.equal(appendAtB.authorId, aId);
    assert.deepEqual(appendAtB.points, points);
    assert.deepEqual(appendAtA.points, points);
    console.log("[smoke] stroke:append relayed with accepted points");

    a.send({ type: "stroke:end", strokeId });
    const endAtB = await b.waitForType("stroke:end");
    assert.equal(endAtB.strokeId, strokeId);
    assert.equal(endAtB.authorId, aId);
    console.log("[smoke] stroke:end relayed");

    b.send({ type: "cursor", x: 512, y: 768 });
    const cursorAtA = await a.waitForType("cursor");
    const cursorAtB = await b.waitForType("cursor");
    assert.equal(cursorAtA.clientId, bId);
    assert.equal(cursorAtA.x, 512);
    assert.equal(cursorAtA.y, 768);
    assert.equal(cursorAtB.clientId, bId);
    console.log("[smoke] cursor relayed to both");

    a.send({ type: "stroke:undo", strokeId });
    const removeAtB = await b.waitForType("stroke:remove");
    const removeAtA = await a.waitForType("stroke:remove");
    assert.equal(removeAtB.strokeId, strokeId);
    assert.equal(removeAtB.reason, "undo");
    assert.equal(removeAtA.strokeId, strokeId);
    console.log("[smoke] undo removed the stroke");

    b.send({ type: "world:clear" });
    const clearedAtA = await a.waitForType("world:cleared");
    const clearedAtB = await b.waitForType("world:cleared");
    assert.equal(clearedAtA.epoch, 1);
    assert.equal(clearedAtA.by, bId);
    assert.equal(typeof clearedAtA.at, "number");
    assert.equal(clearedAtB.epoch, 1);
    console.log("[smoke] world:clear incremented epoch");

    a.sendRaw("{ this is not valid json");
    const badMessage = await a.waitForType("error");
    assert.equal(badMessage.code, "BAD_MESSAGE");
    console.log("[smoke] malformed message yielded BAD_MESSAGE");

    console.log("[smoke] PASS");
  } finally {
    await a.close();
    await b.close();
    await running.close();
  }
}

void main()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error("[smoke] FAIL");
    console.error(error);
    process.exit(1);
  });
