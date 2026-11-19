"use client";

import { useEffect, useRef, type MouseEvent } from "react";

export interface ClearWorldDialogProps {
  open: boolean;
  slug: string;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ClearWorldDialog({
  open,
  slug,
  pending,
  error,
  onCancel,
  onConfirm,
}: ClearWorldDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open && typeof dialog.showModal === "function") {
        dialog.showModal();
      }
    } else if (dialog.open && typeof dialog.close === "function") {
      dialog.close();
    }
  }, [open]);

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (pending) return;

    const dialog = event.currentTarget;
    if (event.target !== dialog) return;

    const rect = dialog.getBoundingClientRect();
    const outside =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;

    if (outside) onCancel();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="clear-world-title"
      aria-describedby="clear-world-description"
      aria-busy={pending || undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onCancel();
      }}
      onClick={handleBackdropClick}
      className="m-auto w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-0 text-[color:var(--foreground)] shadow-xl backdrop:bg-black/40"
    >
      <div className="p-5 sm:p-6">
        <h2
          id="clear-world-title"
          className="font-display text-xl font-semibold tracking-[-0.01em]"
        >
          Dünyayı temizlemek istiyor musun?
        </h2>

        <p
          id="clear-world-description"
          className="mt-3 text-sm leading-relaxed text-[color:var(--muted)]"
        >
          {`"${slug}" dünyasındaki herkesin çizimleri silinecek. Bu işlem geri alınamaz.`}
        </p>

        {error ? (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] px-3 py-2 text-sm leading-relaxed text-[color:var(--warning)]"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            autoFocus
            className="btn-secondary"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[color:var(--danger)] px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Temizleniyor…" : "Evet, temizle"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

export default ClearWorldDialog;
