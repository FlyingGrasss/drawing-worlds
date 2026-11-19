"use client";

import {
  DRAWING_COLORS,
  WIDTH_OPTIONS,
  type DrawingSettings,
} from "@/lib/canvas/settings";
import { cn } from "@/lib/cn";

export interface ToolbarProps {
  settings: DrawingSettings;
  onChange: (patch: Partial<DrawingSettings>) => void;
  canUndo: boolean;
  onUndo: () => void;
  onClear: () => void;
  disabled?: boolean;
}

function PenIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-4 w-4", className)}
    >
      <path d="m4 20 4.6-.9L19 8.7a2.12 2.12 0 0 0-3-3L5.6 16.1 4 20Z" />
      <path d="m14 6 4 4" />
    </svg>
  );
}

function EraserIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-4 w-4", className)}
    >
      <path d="m7 17-3-3 8.5-8.5a2.12 2.12 0 0 1 3 3L7 17Z" />
      <path d="M7 20h13" />
      <path d="m10 9 5 5" />
    </svg>
  );
}

function UndoIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-4 w-4", className)}
    >
      <path d="M4 9h9a5 5 0 0 1 0 10H8" />
      <path d="m8 5-4 4 4 4" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-4 w-4", className)}
    >
      <path d="M4 7h16" />
      <path d="M9 7V5h6v2" />
      <path d="m6 7 1 13h10l1-13" />
      <path d="M10 11v5M14 11v5" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-4 w-4", className)}
    >
      <path d="m5 12 4.5 4.5L19 7" />
    </svg>
  );
}

function Divider() {
  return (
    <span
      aria-hidden="true"
      className="mx-0.5 h-6 w-px bg-[color:var(--border)]"
    />
  );
}

export function CanvasToolbar({
  settings,
  onChange,
  canUndo,
  onUndo,
  onClear,
  disabled = false,
}: ToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Çizim araçları"
      className="pointer-events-auto flex w-fit max-w-[calc(100vw-2rem)] flex-wrap items-center gap-1.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-2 shadow-lg"
    >
      <div role="group" aria-label="Araç" className="flex items-center gap-1">
        <button
          type="button"
          aria-pressed={settings.tool === "pen"}
          aria-label="Kalem"
          title="Kalem"
          disabled={disabled}
          onClick={() => onChange({ tool: "pen" })}
          className={cn(
            "inline-flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
            settings.tool === "pen"
              ? "bg-[color:var(--foreground)] text-[color:var(--surface)]"
              : "text-[color:var(--muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--foreground)]",
          )}
        >
          <PenIcon />
          <span>Kalem</span>
        </button>

        <button
          type="button"
          aria-pressed={settings.tool === "eraser"}
          aria-label="Silgi"
          title="Silgi"
          disabled={disabled}
          onClick={() => onChange({ tool: "eraser" })}
          className={cn(
            "inline-flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
            settings.tool === "eraser"
              ? "bg-[color:var(--foreground)] text-[color:var(--surface)]"
              : "text-[color:var(--muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--foreground)]",
          )}
        >
          <EraserIcon />
          <span>Silgi</span>
        </button>
      </div>

      <Divider />

      <div
        role="group"
        aria-label="Renk paleti"
        className="flex flex-wrap items-center"
      >
        {DRAWING_COLORS.map((color) => {
          const active = settings.color === color.value;
          return (
            <button
              key={color.value}
              type="button"
              aria-pressed={active}
              aria-label={color.label}
              title={color.label}
              disabled={disabled}
              onClick={() => onChange({ color: color.value })}
              className="flex h-11 w-11 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border border-black/10",
                  active && "ring-2 ring-[color:var(--foreground)] ring-offset-2",
                )}
                style={{ backgroundColor: color.value }}
              >
                {active ? <CheckIcon className="h-3.5 w-3.5 text-white" /> : null}
              </span>
            </button>
          );
        })}
      </div>

      <Divider />

      <div
        role="group"
        aria-label="Uç kalınlığı"
        className="flex items-center gap-0.5 rounded-lg bg-[color:var(--surface-subtle)] p-0.5"
      >
        {WIDTH_OPTIONS.map((option) => {
          const active = settings.width === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onChange({ width: option.value })}
              className={cn(
                "h-9 rounded-md px-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                active
                  ? "bg-[color:var(--surface)] text-[color:var(--foreground)]"
                  : "text-[color:var(--muted)] hover:text-[color:var(--foreground)]",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <Divider />

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={disabled || !canUndo}
          onClick={onUndo}
          className={cn(
            "inline-flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-[color:var(--muted)] transition-colors hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          <UndoIcon />
          <span>Geri al</span>
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={onClear}
          className={cn(
            "inline-flex h-10 items-center gap-1.5 rounded-lg border border-[color:var(--border)] px-2.5 text-sm font-medium text-[color:var(--danger)] transition-colors hover:border-[color:var(--danger)] hover:bg-[color:var(--surface-subtle)] disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          <TrashIcon />
          <span>Dünyayı temizle</span>
        </button>
      </div>
    </div>
  );
}

export { CanvasToolbar as Toolbar };
export default CanvasToolbar;
