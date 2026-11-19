"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  ClientMessage,
  CursorEvent,
  ErrorCode,
  ErrorMessage,
  StrokeAppendEvent,
  StrokeEndEvent,
  StrokeRemoveEvent,
  StrokeStartEvent,
  WelcomeMessage,
  WorldClearedEvent,
} from "@shared/protocol";
import type { Presence } from "@shared/world";

import { WorldSocket } from "./client";

export type WorldConnectionStatus =
  | "connecting"
  | "open"
  | "retrying"
  | "failed";

export interface UseWorldConnectionOptions {
  onWelcome?: (message: WelcomeMessage) => void;
  onCursor?: (event: CursorEvent) => void;
  onStrokeStart?: (event: StrokeStartEvent) => void;
  onStrokeAppend?: (event: StrokeAppendEvent) => void;
  onStrokeEnd?: (event: StrokeEndEvent) => void;
  onStrokeRemove?: (event: StrokeRemoveEvent) => void;
  onWorldCleared?: (event: WorldClearedEvent) => void;
  onError?: (message: ErrorMessage) => void;
}

export interface WorldConnection {
  status: WorldConnectionStatus;
  self: Presence | null;
  users: Presence[];
  errorCode: ErrorCode | null;
  send: (message: ClientMessage) => void;
  retry: () => void;
}

function dedupePresence(users: Presence[]): Presence[] {
  const seen = new Set<string>();
  const next: Presence[] = [];

  for (const user of users) {
    if (seen.has(user.clientId)) continue;
    seen.add(user.clientId);
    next.push(user);
  }

  return next;
}

export function useWorldConnection(
  slug: string,
  options: UseWorldConnectionOptions = {},
): WorldConnection {
  const [status, setStatus] = useState<WorldConnectionStatus>("connecting");
  const [self, setSelf] = useState<Presence | null>(null);
  const [users, setUsers] = useState<Presence[]>([]);
  const [errorCode, setErrorCode] = useState<ErrorCode | null>(null);

  const socketRef = useRef<WorldSocket | null>(null);
  const selfRef = useRef<Presence | null>(null);
  const statusRef = useRef<WorldConnectionStatus>("connecting");
  const openedOnceRef = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  statusRef.current = status;

  useEffect(() => {
    let active = true;

    openedOnceRef.current = false;
    selfRef.current = null;
    setSelf(null);
    setUsers([]);
    setErrorCode(null);
    setStatus("connecting");

    const socket = new WorldSocket(slug);
    socketRef.current = socket;

    const unsubscribe = [
      socket.on("open", () => {
        if (!active) return;
        openedOnceRef.current = true;
        setStatus("open");
      }),

      socket.on("welcome", (message) => {
        if (!active) return;
        selfRef.current = message.self;
        setSelf(message.self);
        setUsers(dedupePresence([message.self, ...message.users]));
        setErrorCode(null);
        optionsRef.current.onWelcome?.(message);
      }),

      socket.on("presence:join", (event) => {
        if (!active) return;

        const currentSelf = selfRef.current;
        // The server announces the joiner to everyone, including themselves,
        // right after the welcome snapshot. The self entry is already known.
        if (currentSelf && event.user.clientId === currentSelf.clientId) {
          return;
        }

        setUsers((current) => {
          const index = current.findIndex(
            (user) => user.clientId === event.user.clientId,
          );
          if (index === -1) return [...current, event.user];

          const next = current.slice();
          next[index] = event.user;
          return next;
        });
      }),

      socket.on("presence:leave", (event) => {
        if (!active) return;
        setUsers((current) =>
          current.filter((user) => user.clientId !== event.clientId),
        );
      }),

      socket.on("cursor", (event) => {
        if (!active) return;
        optionsRef.current.onCursor?.(event);
      }),

      socket.on("stroke:start", (event) => {
        if (!active) return;
        optionsRef.current.onStrokeStart?.(event);
      }),

      socket.on("stroke:append", (event) => {
        if (!active) return;
        optionsRef.current.onStrokeAppend?.(event);
      }),

      socket.on("stroke:end", (event) => {
        if (!active) return;
        optionsRef.current.onStrokeEnd?.(event);
      }),

      socket.on("stroke:remove", (event) => {
        if (!active) return;
        optionsRef.current.onStrokeRemove?.(event);
      }),

      socket.on("world:cleared", (event) => {
        if (!active) return;
        optionsRef.current.onWorldCleared?.(event);
      }),

      socket.on("error", (message) => {
        if (!active) return;
        setErrorCode(message.code);
        if (
          message.code === "WORLD_FULL" ||
          message.code === "PROTOCOL_MISMATCH"
        ) {
          setStatus("failed");
        }
        optionsRef.current.onError?.(message);
      }),

      socket.on("close", (info) => {
        if (!active) return;

        selfRef.current = null;
        setSelf(null);
        setUsers([]);

        if (info.willReconnect) {
          // A first connection that never opened is a connection failure;
          // after a successful join a drop is a retry.
          setStatus(openedOnceRef.current ? "retrying" : "failed");
        } else {
          setStatus("failed");
        }
      }),
    ];

    // The constructor connects immediately; this is an idempotent safety call
    // for tests and environments that construct without auto-connect.
    socket.connect();

    return () => {
      active = false;
      for (const off of unsubscribe) off();
      socket.close();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [slug]);

  const send = useCallback((message: ClientMessage) => {
    socketRef.current?.send(message);
  }, []);

  const retry = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || statusRef.current !== "failed") return;

    selfRef.current = null;
    setSelf(null);
    setUsers([]);
    setErrorCode(null);
    setStatus("connecting");
    socket.retry();
  }, []);

  return { status, self, users, errorCode, send, retry };
}

export default useWorldConnection;
