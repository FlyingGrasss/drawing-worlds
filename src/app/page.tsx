import Link from "next/link";

import { CanvasPreview } from "@/components/home/CanvasPreview";
import { HeroActions } from "@/components/home/HeroActions";
import { JoinWorldForm } from "@/components/home/JoinWorldForm";
import { RecentWorlds } from "@/components/home/RecentWorlds";

const STEPS = [
  {
    title: "Dünya aç",
    body: "Tek tıkla renkli bir tuval.",
  },
  {
    title: "Bağlantıyı paylaş",
    body: "Aynı adresi açan herkes aynı dünyaya gelir.",
  },
  {
    title: "Birlikte çiz",
    body: "Çizimler anında herkesin ekranında belirir.",
  },
] as const;

function BrandMark() {
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--primary)" />
      <path
        d="M9.5 22.5 20.8 11.2a2.05 2.05 0 0 1 2.9 2.9L12.4 25.4l-3.8.9.9-3.8Z"
        fill="#fdfaf7"
      />
      <path
        d="m20.2 12.7 2.8 2.8"
        stroke="var(--primary)"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.35"
      />
      <path
        d="m9.5 22.5 2.9 2.9"
        stroke="var(--primary)"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.35"
      />
    </svg>
  );
}

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-[color:var(--border)]">
        <div className="shell flex min-h-16 items-center justify-between gap-4 py-3">
          <Link
            href="/"
            aria-current="page"
            className="flex min-h-11 items-center gap-2.5 rounded-md text-[color:var(--foreground)]"
          >
            <BrandMark />
            <span className="font-display text-lg font-semibold tracking-[-0.01em]">
              Drawing Worlds
            </span>
          </Link>

          <nav
            aria-label="Ana gezinme"
            className="flex items-center gap-1 text-sm font-medium"
          >
            <a
              href="#nasil-calisir"
              className="hidden min-h-11 items-center rounded-md px-3 text-[color:var(--muted)] transition-colors hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--foreground)] sm:inline-flex"
            >
              Nasıl çalışır?
            </a>
            <a
              href="#katil"
              className="inline-flex min-h-11 items-center rounded-md px-3 text-[color:var(--muted)] transition-colors hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--foreground)]"
            >
              Bağlantıyla katıl
            </a>
          </nav>
        </div>
      </header>

      <main id="main" className="flex-1">
        <section className="shell grid gap-12 pb-16 pt-12 sm:pt-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-16 lg:pb-24 lg:pt-20">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--primary-hover)]">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-[color:var(--primary)]"
              />
              Hesap yok. Kurulum yok.
            </p>

            <h1 className="mt-5 max-w-[15ch] font-display text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.025em] text-[color:var(--foreground)] sm:text-6xl lg:text-[4.5rem]">
              Her bağlantı yeni bir{" "}
              <span className="relative inline-block whitespace-nowrap">
                dünya
                <svg
                  viewBox="0 0 120 10"
                  preserveAspectRatio="none"
                  className="absolute -bottom-1 left-0 h-2 w-full"
                  aria-hidden="true"
                >
                  <path
                    d="M2 7.5C31 3.5 83 2.5 118 5.5"
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              {"."}
            </h1>

            <p className="mt-6 max-w-[34rem] text-base leading-relaxed text-[color:var(--muted)] sm:text-lg">
              Rastgele bir dünya aç, bağlantıyı arkadaşlarına gönder; aynı
              tuvalde birlikte çiz. Hesap yok, kurulum yok — sadece bir bağlantı
              ve biraz renk.
            </p>

            <HeroActions />
          </div>

          <div className="lg:justify-self-end">
            <CanvasPreview />
          </div>
        </section>

        <section
          id="nasil-calisir"
          aria-labelledby="nasil-calisir-heading"
          className="border-y border-[color:var(--border)] bg-[color:var(--surface-subtle)]"
        >
          <div className="shell py-12 sm:py-16">
            <h2 id="nasil-calisir-heading" className="sr-only">
              Nasıl çalışır?
            </h2>

            <ol className="grid gap-10 sm:grid-cols-3 sm:gap-8">
              {STEPS.map((step, index) => (
                <li
                  key={step.title}
                  className="border-t border-[color:var(--border-strong)] pt-5"
                >
                  <span className="font-display text-sm font-semibold text-[color:var(--primary-hover)]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-2 font-display text-xl font-semibold text-[color:var(--foreground)]">
                    {step.title}
                  </h3>
                  <p className="mt-2 max-w-xs text-sm leading-relaxed text-[color:var(--muted)]">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <JoinWorldForm />
        <RecentWorlds />

        <section
          aria-labelledby="public-warning-heading"
          className="shell pb-16 sm:pb-20"
        >
          <div className="rounded-xl border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] px-5 py-5 sm:px-6">
            <div className="flex items-start gap-3">
              <svg
                viewBox="0 0 24 24"
                className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--warning)]"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 3 22 21H2L12 3Z" />
                <path d="M12 9v5" />
                <path d="M12 18h.01" />
              </svg>
              <div>
                <h2
                  id="public-warning-heading"
                  className="font-display text-base font-semibold text-[color:var(--warning)]"
                >
                  Herkese açık tuvaller
                </h2>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[color:var(--warning)]">
                  Dünyalar herkese açıktır. Bağlantıya sahip olan herkes
                  çizebilir ve dünyayı temizleyebilir. Özel bilgilerini çizme.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[color:var(--border)]">
        <div className="shell py-8">
          <p className="text-sm text-[color:var(--muted)]">
            Drawing Worlds — arkadaşlarınla aynı tuvalde çiz.
          </p>
        </div>
      </footer>
    </div>
  );
}
