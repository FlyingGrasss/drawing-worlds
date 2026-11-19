"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  formatRecentTime,
  readRecentWorlds,
  type RecentWorld,
} from "./recent-worlds";

export function RecentWorlds() {
  const [worlds, setWorlds] = useState<RecentWorld[] | null>(null);

  useEffect(() => {
    setWorlds(readRecentWorlds());
  }, []);

  return (
    <section
      aria-labelledby="recent-worlds-heading"
      className="shell pb-16 sm:pb-20"
    >
      <div className="border-t border-[color:var(--border)] pt-10">
        <h2
          id="recent-worlds-heading"
          className="font-display text-2xl font-semibold tracking-[-0.015em] text-[color:var(--foreground)] sm:text-3xl"
        >
          Son dünyaların
        </h2>
        <p className="mt-2 text-sm text-[color:var(--muted)]">
          Bu tarayıcıda açtığın dünyalar.
        </p>

        <div
          className="mt-6"
          aria-busy={worlds === null ? true : undefined}
        >
          {worlds === null ? (
            <div
              aria-hidden="true"
              className="h-[4.75rem] max-w-2xl animate-pulse rounded-lg border border-dashed border-[color:var(--border)] bg-[color:var(--surface-subtle)]"
            />
          ) : worlds.length === 0 ? (
            <p className="max-w-xl rounded-lg border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface)] px-4 py-4 text-sm leading-relaxed text-[color:var(--muted)]">
              Henüz bir dünyan yok. Yukarıdan rastgele bir dünya aç.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {worlds.map((world) => (
                <li key={world.slug}>
                  <Link
                    href={`/w/${world.slug}`}
                    className="group flex items-center justify-between gap-4 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 transition-colors hover:border-[color:var(--border-strong)] hover:bg-white"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-display text-base font-semibold text-[color:var(--foreground)]">
                        {world.name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-[color:var(--muted)]">
                        {world.slug} · {formatRecentTime(world.at)}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="shrink-0 text-[color:var(--border-strong)] transition-colors group-hover:text-[color:var(--primary)]"
                    >
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
