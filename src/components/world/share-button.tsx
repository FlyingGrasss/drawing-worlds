"use client";

import { useEffect, useRef, useState } from "react";

type ShareStatus = "idle" | "copied" | "failed";

function copyWithTextarea(value: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);

  try {
    textarea.select();
    textarea.setSelectionRange(0, value.length);
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // The clipboard API can reject without permission; fall back below.
  }

  return copyWithTextarea(value);
}

function LinkIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
    >
      <path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1L10.7 5" />
      <path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.3-1.1" />
    </svg>
  );
}

export interface ShareButtonProps {
  slug: string;
}

export function ShareButton({ slug }: ShareButtonProps) {
  const [status, setStatus] = useState<ShareStatus>("idle");
  const [shareUrl, setShareUrl] = useState("");
  const timerRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (status !== "failed") return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, [status]);

  async function handleCopy() {
    const url = `${window.location.origin}/w/${slug}`;
    setShareUrl(url);

    const copied = await copyText(url);
    if (!copied) {
      setStatus("failed");
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    setStatus("copied");
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setStatus("idle");
    }, 3_000);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => void handleCopy()}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-semibold text-[color:var(--foreground)] transition-colors hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
      >
        <LinkIcon />
        Bağlantıyı kopyala
      </button>

      <div
        role="status"
        aria-live="polite"
        className="absolute left-0 top-full z-50 mt-2 w-[min(18rem,calc(100vw-2.5rem))] sm:left-auto sm:right-0"
      >
        {status === "copied" ? (
          <p className="w-fit max-w-full rounded-md bg-[color:var(--foreground)] px-2.5 py-1.5 text-xs font-medium text-[color:var(--background)] shadow-md">
            Bağlantı kopyalandı.
          </p>
        ) : null}

        {status === "failed" ? (
          <div className="rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface)] p-3 shadow-lg">
            <p className="text-xs font-medium leading-relaxed text-[color:var(--danger)]">
              Kopyalanamadı. Bağlantıyı seçip kopyala.
            </p>
            <input
              ref={inputRef}
              type="text"
              readOnly
              value={shareUrl}
              aria-label="Dünya bağlantısı"
              onFocus={(event) => event.currentTarget.select()}
              className="field mt-2 min-h-9 text-xs"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default ShareButton;
