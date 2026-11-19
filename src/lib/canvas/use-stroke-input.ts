"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";

import {
  ERASER_COLOR,
  LIMITS,
  WORLD_SIZE,
  type Point,
  type Stroke,
} from "@shared/world";

import type { DrawingSettings } from "./settings";

const MIN_SAMPLE_DISTANCE = 1.5;
const BATCH_INTERVAL_MS = 50;
const MAX_BATCH_POINTS = 24;
const CURSOR_INTERVAL_MS = 50;

export interface UseStrokeInputOptions {
  enabled: boolean;
  settings: DrawingSettings;
  selfId: string | null;
  onLocalStart: (stroke: Stroke) => void;
  onLocalAppend: (strokeId: string, points: Point[]) => void;
  onLocalEnd: (strokeId: string) => void;
  onCursorMove: (point: Point) => void;
  onStrokeLimit?: () => void;
}

export interface StrokeInputHandlers {
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onLostPointerCapture: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

export interface StrokeInput {
  handlers: StrokeInputHandlers;
  cancelActive: () => void;
}

interface ActiveStroke {
  pointerId: number;
  captureElement: HTMLDivElement;
  strokeId: string;
  lastSampledPoint: Point;
  pointCount: number;
  pending: Point[];
  flushTimer: number | null;
}

function roundWorld(value: number): number {
  const clamped = Math.min(WORLD_SIZE, Math.max(0, value));
  return Math.round(clamped * 10) / 10;
}

function pointerToWorld(event: ReactPointerEvent<HTMLDivElement>): Point {
  const rect = event.currentTarget.getBoundingClientRect();
  const side = Math.max(1, Math.min(rect.width, rect.height));
  const offsetX = (rect.width - side) / 2;
  const offsetY = (rect.height - side) / 2;
  const x = ((event.clientX - rect.left - offsetX) / side) * WORLD_SIZE;
  const y = ((event.clientY - rect.top - offsetY) / side) * WORLD_SIZE;
  return [roundWorld(x), roundWorld(y)];
}

function createStrokeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useStrokeInput(options: UseStrokeInputOptions): StrokeInput {
  const { enabled, selfId } = options;
  const latestRef = useRef(options);
  const activeRef = useRef<ActiveStroke | null>(null);
  const lastCursorAtRef = useRef(Number.NEGATIVE_INFINITY);
  latestRef.current = options;

  const clearFlushTimer = useCallback((active: ActiveStroke) => {
    if (active.flushTimer !== null) {
      window.clearTimeout(active.flushTimer);
      active.flushTimer = null;
    }
  }, []);

  const releaseCapture = useCallback((active: ActiveStroke) => {
    try {
      if (active.captureElement.hasPointerCapture(active.pointerId)) {
        active.captureElement.releasePointerCapture(active.pointerId);
      }
    } catch {
      // The pointer or its element may already be gone.
    }
  }, []);

  const flushPending = useCallback(
    (active: ActiveStroke) => {
      clearFlushTimer(active);
      if (active.pending.length === 0) {
        return;
      }

      const points = active.pending;
      active.pending = [];
      latestRef.current.onLocalAppend(active.strokeId, points);
    },
    [clearFlushTimer],
  );

  const finishActive = useCallback(
    (notifyEnd: boolean, limitReached = false) => {
      const active = activeRef.current;
      if (!active) {
        return;
      }

      activeRef.current = null;
      flushPending(active);
      releaseCapture(active);

      if (limitReached) {
        latestRef.current.onStrokeLimit?.();
      }
      if (notifyEnd) {
        latestRef.current.onLocalEnd(active.strokeId);
      }
    },
    [flushPending, releaseCapture],
  );

  const cancelActive = useCallback(() => {
    const active = activeRef.current;
    if (!active) {
      return;
    }

    activeRef.current = null;
    clearFlushTimer(active);
    active.pending = [];
    releaseCapture(active);
  }, [clearFlushTimer, releaseCapture]);

  const scheduleFlush = useCallback(
    (active: ActiveStroke) => {
      if (active.flushTimer !== null) {
        return;
      }

      active.flushTimer = window.setTimeout(() => {
        active.flushTimer = null;
        if (activeRef.current !== active) {
          return;
        }
        flushPending(active);
      }, BATCH_INTERVAL_MS);
    },
    [flushPending],
  );

  const addSampledPoint = useCallback(
    (active: ActiveStroke, point: Point): void => {
      const [lastX, lastY] = active.lastSampledPoint;
      const distance = Math.hypot(point[0] - lastX, point[1] - lastY);
      if (distance < MIN_SAMPLE_DISTANCE) {
        return;
      }

      active.lastSampledPoint = point;
      active.pending.push(point);
      active.pointCount += 1;

      if (active.pending.length >= MAX_BATCH_POINTS) {
        flushPending(active);
      } else {
        scheduleFlush(active);
      }

      if (active.pointCount >= LIMITS.maxPointsPerStroke) {
        finishActive(true, true);
      }
    },
    [finishActive, flushPending, scheduleFlush],
  );

  const emitCursor = useCallback((point: Point) => {
    const now = Date.now();
    if (now - lastCursorAtRef.current < CURSOR_INTERVAL_MS) {
      return;
    }

    lastCursorAtRef.current = now;
    latestRef.current.onCursorMove(point);
  }, []);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const latest = latestRef.current;
      if (
        !latest.enabled ||
        latest.selfId === null ||
        activeRef.current !== null ||
        !event.isPrimary ||
        event.button !== 0
      ) {
        return;
      }

      const target = event.target;
      if (
        target !== event.currentTarget &&
        !(target instanceof HTMLCanvasElement)
      ) {
        return;
      }

      event.preventDefault();

      const point = pointerToWorld(event);
      const tool = latest.settings.tool;
      const stroke: Stroke = {
        id: createStrokeId(),
        authorId: latest.selfId,
        tool,
        color: tool === "eraser" ? ERASER_COLOR : latest.settings.color,
        width: latest.settings.width,
        points: [point],
        createdAt: Date.now(),
      };

      activeRef.current = {
        pointerId: event.pointerId,
        captureElement: event.currentTarget,
        strokeId: stroke.id,
        lastSampledPoint: point,
        pointCount: 1,
        pending: [],
        flushTimer: null,
      };

      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Browsers can reject capture for a pointer that already ended.
      }

      latest.onLocalStart(stroke);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const latest = latestRef.current;
      if (!latest.enabled) {
        return;
      }

      const active = activeRef.current;
      if (active && active.pointerId !== event.pointerId) {
        return;
      }

      const point = pointerToWorld(event);
      emitCursor(point);

      if (active) {
        addSampledPoint(active, point);
      }
    },
    [addSampledPoint, emitCursor],
  );

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const active = activeRef.current;
      if (!active || active.pointerId !== event.pointerId) {
        return;
      }

      addSampledPoint(active, pointerToWorld(event));
      if (activeRef.current === active) {
        finishActive(true);
      }
    },
    [addSampledPoint, finishActive],
  );

  const handlePointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const active = activeRef.current;
      if (!active || active.pointerId !== event.pointerId) {
        return;
      }

      finishActive(true);
    },
    [finishActive],
  );

  const handleLostPointerCapture = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const active = activeRef.current;
      if (!active || active.pointerId !== event.pointerId) {
        return;
      }

      finishActive(true);
    },
    [finishActive],
  );

  useEffect(() => {
    if (!enabled || selfId === null) {
      cancelActive();
    }
  }, [cancelActive, enabled, selfId]);

  useEffect(() => {
    return () => {
      cancelActive();
    };
  }, [cancelActive]);

  return {
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
      onLostPointerCapture: handleLostPointerCapture,
    },
    cancelActive,
  };
}
