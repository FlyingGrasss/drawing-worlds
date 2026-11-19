"use client";

import Link from "next/link";

import type { ErrorCode } from "@shared/protocol";

import { worldTitleFromSlug } from "@/lib/worlds/names";
import type { WorldConnectionStatus } from "@/lib/realtime/use-world-connection";

import { ConnectionStatus } from "./connection-status";
import { ShareButton } from "./share-button";

export interface WorldHeaderProps {
  slug: string;
  status: WorldConnectionStatus;
  errorCode: ErrorCode | null;
  onRetry: () => void;
}

export function WorldHeader({
  slug,
  status,
  errorCode,
  onRetry,
}: WorldHeaderProps) {
  const title = worldTitleFromSlug(slug) || slug;

  return (
    <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
      <div className="shell flex flex-wrap items-center gap-x-5 gap-y-2.5 py-3">
        <Link
          href="/"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md text-sm font-medium text-[color:var(--muted)] transition-colors hover:text-[color:var(--foreground)]"
        >
          <span aria-hidden="true">←</span>
          Ana sayfa
        </Link>

        <div className="min-w-0 flex-1 basis-52">
          <h1 className="truncate font-display text-lg font-semibold tracking-[-0.01em] text-[color:var(--foreground)]">
            {title}
          </h1>
          <p className="mt-0.5 text-xs text-[color:var(--muted)]">
            Aynı bağlantıya gelen herkes bu tuvalde çizer.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ShareButton slug={slug} />
          <ConnectionStatus
            status={status}
            errorCode={errorCode}
            onRetry={onRetry}
          />
        </div>
      </div>
    </header>
  );
}

export default WorldHeader;
