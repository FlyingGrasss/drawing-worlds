import Link from "next/link";

export default function NotFound() {
  return (
    <main
      id="main"
      className="shell flex min-h-screen flex-col justify-center py-16"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--primary-hover)]">
        404
      </p>
      <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.05] tracking-[-0.02em] text-[color:var(--foreground)] sm:text-5xl">
        Sayfa bulunamadı.
      </h1>
      <p className="mt-4 max-w-xl text-base leading-relaxed text-[color:var(--muted)]">
        Aradığın sayfa taşınmış ya da hiç var olmamış olabilir.
      </p>
      <Link href="/" className="btn-primary mt-8 self-start">
        Ana sayfaya dön
      </Link>
    </main>
  );
}
