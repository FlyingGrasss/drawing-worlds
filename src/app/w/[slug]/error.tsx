"use client";

import Link from "next/link";

export default function WorldError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      id="main"
      className="shell flex min-h-[100dvh] flex-col justify-center py-16"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--primary-hover)]">
        Bir aksilik oldu
      </p>
      <h1 className="mt-4 max-w-2xl font-display text-4xl font-semibold leading-[1.05] tracking-[-0.02em] text-[color:var(--foreground)] sm:text-5xl">
        Dünya yüklenemedi.
      </h1>
      <p className="mt-4 max-w-xl text-base leading-relaxed text-[color:var(--muted)]">
        Bir şeyler ters gitti. Sayfayı yeniden yüklemeyi dene ya da ana sayfaya
        dön.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button type="button" className="btn-primary" onClick={() => reset()}>
          Tekrar dene
        </button>
        <Link href="/" className="btn-secondary">
          Ana sayfa
        </Link>
      </div>
    </main>
  );
}
