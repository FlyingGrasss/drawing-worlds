"use client";

import type { ErrorCode } from "@shared/protocol";

import { cn } from "@/lib/cn";
import type { WorldConnectionStatus } from "@/lib/realtime/use-world-connection";

export function connectionStatusLabel(
  status: WorldConnectionStatus,
  errorCode: ErrorCode | null,
): string {
  switch (status) {
    case "connecting":
      return "Bağlanıyor…";
    case "open":
      return "Bağlı";
    case "retrying":
      return "Bağlantı koptu — yeniden deneniyor…";
    case "failed":
      return errorCode === "WORLD_FULL"
        ? "Dünya dolu."
        : "Sunucuya bağlanılamadı.";
  }
}

export interface ConnectionStatusProps {
  status: WorldConnectionStatus;
  errorCode: ErrorCode | null;
  onRetry: () => void;
}

export function ConnectionStatus({
  status,
  errorCode,
  onRetry,
}: ConnectionStatusProps) {
  const label = connectionStatusLabel(status, errorCode);
  const canRetry = status === "failed" && errorCode !== "WORLD_FULL";

  return (
    <div className="inline-flex min-h-9 max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1 text-xs font-medium text-[color:var(--muted)]">
      <span
        aria-hidden="true"
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          status === "open"
            ? "bg-[color:var(--success)]"
            : status === "failed"
              ? "bg-[color:var(--danger)]"
              : "animate-pulse bg-[color:var(--warning)]",
        )}
      />

      <span aria-live="polite">{label}</span>

      {canRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-9 items-center rounded-full border border-[color:var(--border-strong)] px-2.5 text-[11px] font-semibold text-[color:var(--foreground)] transition-colors hover:bg-[color:var(--surface-subtle)]"
        >
          Yeniden dene
        </button>
      ) : null}
    </div>
  );
}

export default ConnectionStatus;
