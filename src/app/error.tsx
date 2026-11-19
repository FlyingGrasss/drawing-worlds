"use client";

import Link from "next/link";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      id="main"
      className="shell flex min-h-screen flex-col justify-center py-16"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--primary-hover)]">
        Bir aksilik oldu
      </p>
      <h1 className="mt-4 max-w-2xl font-display text-4xl font-semibold leading-[1.05] tracking-[-0.02em] text-[color:var(--foreground)] sm:text-5xl">
        Bir şeyler ters gitti. Tekrar dene.
      </h1>
      <p className="mt-4 max-w-xl text-base leading-relaxed text-[color:var(--muted)]">
        Sayfayı yeniden yüklemeyi deneyebilir ya da ana sayfaya dönebilirsin.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button type="button" className="btn-primary" onClick={() => reset()}>
          Tekrar dene
        </button>
        <Link href="/" className="btn-secondary">
          Ana sayfaya dön
        </Link>
      </div>
    </main>
  );
}
