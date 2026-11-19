"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { Point, Stroke } from "@shared/world";

import { cn } from "@/lib/cn";

import type { DrawingSettings } from "@/lib/canvas/settings";
import { WorldRenderer } from "@/lib/canvas/renderer";
import { useStrokeInput } from "@/lib/canvas/use-stroke-input";

export type CanvasStageHandle = {
  applySnapshot(strokes: Stroke[]): void;
  startRemoteStroke(stroke: Stroke): void;
  appendRemotePoints(strokeId: string, points: Point[]): void;
  removeStroke(strokeId: string): void;
  clearWorld(): void;
};

export type CanvasStageProps = {
  enabled: boolean;
  settings: DrawingSettings;
  selfId: string | null;
  onLocalStart(stroke: Stroke): void;
  onLocalAppend(strokeId: string, points: Point[]): void;
  onLocalEnd(strokeId: string): void;
  onCursorMove(point: Point): void;
  onStrokeLimit?: () => void;
  emptyState?: ReactNode;
  overlay?: ReactNode;
  cursorLayer?: ReactNode;
};

export const CanvasStage = forwardRef<CanvasStageHandle, CanvasStageProps>(
  function CanvasStage(
    {
      enabled,
      settings,
      selfId,
      onLocalStart,
      onLocalAppend,
      onLocalEnd,
      onCursorMove,
      onStrokeLimit,
      emptyState,
      overlay,
      cursorLayer,
    },
    ref,
  ) {
    const boxRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const rendererRef = useRef<WorldRenderer | null>(null);
    const pendingSnapshotRef = useRef<Stroke[] | null>(null);
    const [hasStrokes, setHasStrokes] = useState(false);

    useEffect(() => {
      const canvas = canvasRef.current;
      const box = boxRef.current;
      if (!canvas || !box) {
        return;
      }

      const renderer = new WorldRenderer(canvas, box);
      rendererRef.current = renderer;

      const pendingSnapshot = pendingSnapshotRef.current;
      if (pendingSnapshot) {
        pendingSnapshotRef.current = null;
        renderer.setStrokes(pendingSnapshot);
      }
      setHasStrokes(renderer.hasStrokes);

      return () => {
        renderer.dispose();
        if (rendererRef.current === renderer) {
          rendererRef.current = null;
        }
      };
    }, []);

    const handleLocalStart = useCallback(
      (stroke: Stroke) => {
        const renderer = rendererRef.current;
        if (renderer) {
          renderer.startStroke(stroke);
          setHasStrokes(renderer.hasStrokes);
        }
        onLocalStart(stroke);
      },
      [onLocalStart],
    );

    const handleLocalAppend = useCallback(
      (strokeId: string, points: Point[]) => {
        rendererRef.current?.appendPoints(strokeId, points);
        onLocalAppend(strokeId, points);
      },
      [onLocalAppend],
    );

    const handleLocalEnd = useCallback(
      (strokeId: string) => {
        onLocalEnd(strokeId);
      },
      [onLocalEnd],
    );

    const { handlers, cancelActive } = useStrokeInput({
      enabled,
      settings,
      selfId,
      onLocalStart: handleLocalStart,
      onLocalAppend: handleLocalAppend,
      onLocalEnd: handleLocalEnd,
      onCursorMove,
      onStrokeLimit,
    });

    useImperativeHandle(
      ref,
      () => ({
        applySnapshot(strokes) {
          cancelActive();
          const renderer = rendererRef.current;
          if (!renderer) {
            pendingSnapshotRef.current = strokes;
            setHasStrokes(strokes.length > 0);
            return;
          }
          renderer.setStrokes(strokes);
          setHasStrokes(renderer.hasStrokes);
        },
        startRemoteStroke(stroke) {
          const renderer = rendererRef.current;
          if (!renderer) {
            return;
          }
          renderer.startStroke(stroke);
          setHasStrokes(renderer.hasStrokes);
        },
        appendRemotePoints(strokeId, points) {
          rendererRef.current?.appendPoints(strokeId, points);
        },
        removeStroke(strokeId) {
          const renderer = rendererRef.current;
          if (!renderer) {
            return;
          }
          renderer.removeStroke(strokeId);
          setHasStrokes(renderer.hasStrokes);
        },
        clearWorld() {
          cancelActive();
          pendingSnapshotRef.current = null;
          const renderer = rendererRef.current;
          if (!renderer) {
            setHasStrokes(false);
            return;
          }
          renderer.clear();
          setHasStrokes(renderer.hasStrokes);
        },
      }),
      [cancelActive],
    );

    return (
      <div className="relative flex h-full min-h-[20rem] w-full items-center justify-center [container-type:size]">
        <div
          ref={boxRef}
          role="group"
          aria-label="Çizim alanı"
          data-testid="canvas-stage"
          data-canvas-stage="true"
          data-has-strokes={hasStrokes ? "true" : "false"}
          className={cn(
            "relative h-[min(100cqw,100cqh)] w-[min(100cqw,100cqh)] touch-none select-none overflow-hidden rounded-xl bg-[#faf9f5] ring-1 ring-inset ring-[color:var(--border)]",
            enabled ? "cursor-crosshair" : "cursor-default",
          )}
          {...handlers}
        >
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className="absolute inset-0 h-full w-full touch-none"
          />

          {emptyState && !hasStrokes ? (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6 text-center">
              {emptyState}
            </div>
          ) : null}

          {cursorLayer ? (
            <div className="pointer-events-none absolute inset-0 z-20">
              {cursorLayer}
            </div>
          ) : null}

          {overlay ? (
            <div className="pointer-events-none absolute inset-0 z-30">
              {overlay}
            </div>
          ) : null}
        </div>
      </div>
    );
  },
);

CanvasStage.displayName = "CanvasStage";

export default CanvasStage;
