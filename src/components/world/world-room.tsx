"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  CursorEvent,
  ErrorCode,
  ErrorMessage,
  StrokeAppendEvent,
  StrokeRemoveEvent,
  StrokeStartEvent,
  WelcomeMessage,
  WorldClearedEvent,
} from "@shared/protocol";
import type { Point, Stroke } from "@shared/world";

import { CanvasStage, type CanvasStageHandle } from "./canvas/canvas-stage";
import { CanvasToolbar } from "./canvas/toolbar";
import { ClearWorldDialog } from "./clear-world-dialog";
import { connectionStatusLabel } from "./connection-status";
import { PresenceLayer, type PresenceLayerHandle } from "./presence-layer";
import { WorldHeader } from "./world-header";

import { rememberWorld } from "@/components/home/recent-worlds";
import { useDrawingSettings } from "@/lib/canvas/settings";
import {
  useWorldConnection,
  type WorldConnectionStatus,
} from "@/lib/realtime/use-world-connection";
import { worldTitleFromSlug } from "@/lib/worlds/names";

const RATE_LIMIT_MESSAGE = "Çok hızlı çiziyorsun; bir an bekle.";
const WORLD_LIMIT_MESSAGE =
  "Bu dünya çizim sınırına ulaştı. Temizleyip devam edebilirsin.";
const CLEAR_COOLDOWN_MESSAGE =
  "Temizlenemedi. Birkaç saniye sonra tekrar dene.";
const WORLD_CLEARED_SELF_MESSAGE = "Dünya temizlendi.";
const WORLD_CLEARED_OTHER_MESSAGE =
  "Dünya başka biri tarafından temizlendi.";
const HELP_TEXT =
  "Çizmek için fareyle veya parmağınla sürükle. Silgiyle sil, geri al ile son çizimini kaldır.";

interface StageOverlayProps {
  status: WorldConnectionStatus;
  errorCode: ErrorCode | null;
  onRetry: () => void;
}

function StageOverlay({ status, errorCode, onRetry }: StageOverlayProps) {
  const canRetry = status === "failed" && errorCode !== "WORLD_FULL";

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[rgba(253,250,247,0.82)] p-4">
      <div className="pointer-events-auto max-w-xs rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-5 py-4 text-center shadow-lg">
        <p className="text-sm font-medium leading-relaxed text-[color:var(--foreground)]">
          {connectionStatusLabel(status, errorCode)}
        </p>

        {canRetry ? (
          <button type="button" onClick={onRetry} className="btn-secondary mt-3">
            Yeniden dene
          </button>
        ) : null}
      </div>
    </div>
  );
}

export interface WorldRoomProps {
  slug: string;
}

export function WorldRoom({ slug }: WorldRoomProps) {
  const [settings, updateSettings] = useDrawingSettings();
  const stageRef = useRef<CanvasStageHandle | null>(null);
  const presenceRef = useRef<PresenceLayerHandle | null>(null);
  const undoStackRef = useRef<string[]>([]);
  const pendingUndoRef = useRef<string | null>(null);
  const selfIdRef = useRef<string | null>(null);
  const clearPendingRef = useRef(false);

  const [canUndo, setCanUndo] = useState(false);
  const [undoPending, setUndoPending] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearPending, setClearPending] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);

  const toastTimerRef = useRef<number | null>(null);
  const toastIdRef = useRef(0);

  const showToast = useCallback((text: string) => {
    toastIdRef.current += 1;
    setToast({ id: toastIdRef.current, text });

    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      toastTimerRef.current = null;
      setToast(null);
    }, 4_500);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const handleWelcome = useCallback(
    (message: WelcomeMessage) => {
      selfIdRef.current = message.self.clientId;
      stageRef.current?.applySnapshot(message.strokes);
      presenceRef.current?.clear();

      undoStackRef.current = [];
      pendingUndoRef.current = null;
      setCanUndo(false);
      setUndoPending(false);

      clearPendingRef.current = false;
      setClearPending(false);
      setClearError(null);
      setClearOpen(false);

      rememberWorld({
        slug,
        name: worldTitleFromSlug(slug),
      });
    },
    [slug],
  );

  const handleCursor = useCallback((event: CursorEvent) => {
    if (event.clientId === selfIdRef.current) {
      // A solo visitor should still see the presence chips after moving.
      presenceRef.current?.reveal();
      return;
    }
    presenceRef.current?.updateCursor(event.clientId, [event.x, event.y]);
  }, []);

  const handleStrokeStart = useCallback((event: StrokeStartEvent) => {
    stageRef.current?.startRemoteStroke(event.stroke);
  }, []);

  const handleStrokeAppend = useCallback((event: StrokeAppendEvent) => {
    // The server echoes every append to the sender; the local renderer
    // already received these points optimistically.
    if (event.authorId === selfIdRef.current) return;
    stageRef.current?.appendRemotePoints(event.strokeId, event.points);
  }, []);

  const handleStrokeRemove = useCallback((event: StrokeRemoveEvent) => {
    stageRef.current?.removeStroke(event.strokeId);

    if (undoStackRef.current.includes(event.strokeId)) {
      undoStackRef.current = undoStackRef.current.filter(
        (strokeId) => strokeId !== event.strokeId,
      );
      setCanUndo(undoStackRef.current.length > 0);
    }

    if (pendingUndoRef.current === event.strokeId) {
      pendingUndoRef.current = null;
      setUndoPending(false);
    }
  }, []);

  const handleWorldCleared = useCallback(
    (event: WorldClearedEvent) => {
      stageRef.current?.clearWorld();
      presenceRef.current?.clear();

      undoStackRef.current = [];
      pendingUndoRef.current = null;
      setCanUndo(false);
      setUndoPending(false);

      clearPendingRef.current = false;
      setClearPending(false);
      setClearError(null);
      setClearOpen(false);

      const wasSelf = event.by === selfIdRef.current;
      showToast(
        wasSelf ? WORLD_CLEARED_SELF_MESSAGE : WORLD_CLEARED_OTHER_MESSAGE,
      );
    },
    [showToast],
  );

  const handleError = useCallback(
    (message: ErrorMessage) => {
      if (clearPendingRef.current) {
        clearPendingRef.current = false;
        setClearPending(false);
        if (message.code === "CLEAR_COOLDOWN") {
          setClearError(CLEAR_COOLDOWN_MESSAGE);
        }
      }

      switch (message.code) {
        case "RATE_LIMITED":
          showToast(RATE_LIMIT_MESSAGE);
          return;
        case "WORLD_LIMIT":
        case "STROKE_LIMIT":
          showToast(WORLD_LIMIT_MESSAGE);
          return;
        case "STROKE_NOT_FOUND":
        case "NOT_AUTHORIZED": {
          const strokeId = message.strokeId;
          if (!strokeId || strokeId !== pendingUndoRef.current) return;

          pendingUndoRef.current = null;
          setUndoPending(false);
          undoStackRef.current = undoStackRef.current.filter(
            (candidate) => candidate !== strokeId,
          );
          setCanUndo(undoStackRef.current.length > 0);
          return;
        }
        default:
          return;
      }
    },
    [showToast],
  );

  const { status, self, users, errorCode, send, retry } = useWorldConnection(
    slug,
    {
      onWelcome: handleWelcome,
      onCursor: handleCursor,
      onStrokeStart: handleStrokeStart,
      onStrokeAppend: handleStrokeAppend,
      onStrokeRemove: handleStrokeRemove,
      onWorldCleared: handleWorldCleared,
      onError: handleError,
    },
  );

  selfIdRef.current = self?.clientId ?? null;

  const isOpen = status === "open" && self !== null;

  useEffect(() => {
    if (status === "open") return;

    pendingUndoRef.current = null;
    setUndoPending(false);

    clearPendingRef.current = false;
    setClearPending(false);
  }, [status]);

  const handleLocalStart = useCallback(
    (stroke: Stroke) => {
      const point = stroke.points[0];
      if (!point) return;

      send({
        type: "stroke:start",
        strokeId: stroke.id,
        tool: stroke.tool,
        color: stroke.color,
        width: stroke.width,
        point,
      });
    },
    [send],
  );

  const handleLocalAppend = useCallback(
    (strokeId: string, points: Point[]) => {
      if (points.length === 0) return;
      send({ type: "stroke:append", strokeId, points });
    },
    [send],
  );

  const handleLocalEnd = useCallback(
    (strokeId: string) => {
      send({ type: "stroke:end", strokeId });

      undoStackRef.current = [...undoStackRef.current, strokeId];
      setCanUndo(true);
    },
    [send],
  );

  const handleLocalCursor = useCallback(
    (point: Point) => {
      send({ type: "cursor", x: point[0], y: point[1] });
    },
    [send],
  );

  const handleStrokeLimit = useCallback(() => {
    showToast(WORLD_LIMIT_MESSAGE);
  }, [showToast]);

  const handleUndo = useCallback(() => {
    if (status !== "open" || pendingUndoRef.current !== null) return;

    const strokeId = undoStackRef.current[undoStackRef.current.length - 1];
    if (!strokeId) return;

    pendingUndoRef.current = strokeId;
    setUndoPending(true);
    send({ type: "stroke:undo", strokeId });
  }, [send, status]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.shiftKey) return;
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() !== "z") return;
      if (clearOpen) return;

      const target = event.target;
      if (target instanceof HTMLElement) {
        const tagName = target.tagName;
        if (
          target.isContentEditable ||
          tagName === "INPUT" ||
          tagName === "TEXTAREA" ||
          tagName === "SELECT"
        ) {
          return;
        }
      }

      event.preventDefault();
      handleUndo();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clearOpen, handleUndo]);

  const openClearDialog = useCallback(() => {
    if (status !== "open" || self === null) return;
    setClearError(null);
    setClearOpen(true);
  }, [self, status]);

  const cancelClearDialog = useCallback(() => {
    if (clearPending) return;
    setClearError(null);
    setClearOpen(false);
  }, [clearPending]);

  const confirmClear = useCallback(() => {
    if (
      status !== "open" ||
      self === null ||
      clearPending ||
      clearPendingRef.current
    ) {
      return;
    }

    clearPendingRef.current = true;
    setClearError(null);
    setClearPending(true);
    send({ type: "world:clear" });
  }, [clearPending, self, send, status]);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <WorldHeader
        slug={slug}
        status={status}
        errorCode={errorCode}
        onRetry={retry}
      />

      <main
        id="main"
        className="shell flex w-full flex-1 flex-col py-4 sm:py-6"
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <CanvasStage
              ref={stageRef}
              enabled={isOpen}
              settings={settings}
              selfId={self?.clientId ?? null}
              onLocalStart={handleLocalStart}
              onLocalAppend={handleLocalAppend}
              onLocalEnd={handleLocalEnd}
              onCursorMove={handleLocalCursor}
              onStrokeLimit={handleStrokeLimit}
              emptyState={
                <div className="max-w-xs rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-5 py-4 shadow-sm">
                  <p className="font-display text-base font-semibold text-[color:var(--foreground)]">
                    Bu dünya henüz boş.
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-[color:var(--muted)]">
                    İlk çizimi sen yap; bağlantıyı paylaş, arkadaşların da aynı
                    tuvalde belirsin.
                  </p>
                </div>
              }
              cursorLayer={<PresenceLayer ref={presenceRef} users={users} />}
              overlay={
                isOpen ? undefined : (
                  <StageOverlay
                    status={status === "open" ? "connecting" : status}
                    errorCode={errorCode}
                    onRetry={retry}
                  />
                )
              }
            />
          </div>

          <div className="mt-3 flex flex-col items-center gap-3 sm:mt-4">
            <CanvasToolbar
              settings={settings}
              onChange={updateSettings}
              canUndo={canUndo && !undoPending}
              onUndo={handleUndo}
              onClear={openClearDialog}
              disabled={!isOpen}
            />
            <p className="max-w-2xl text-center text-xs leading-relaxed text-[color:var(--muted)] sm:text-sm">
              {HELP_TEXT}
            </p>
          </div>
        </div>
      </main>

      <ClearWorldDialog
        open={clearOpen}
        slug={slug}
        pending={clearPending}
        error={clearError}
        onCancel={cancelClearDialog}
        onConfirm={confirmClear}
      />

      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
      >
        {toast ? (
          <div
            key={toast.id}
            className="rounded-lg bg-[color:var(--foreground)] px-4 py-2.5 text-sm font-medium text-[color:var(--background)] shadow-lg"
          >
            {toast.text}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default WorldRoom;
