"use client";

import { useRouter } from "next/navigation";
import {
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import { worldTitleFromSlug } from "@/lib/worlds/names";
import { normalizeWorldSlug } from "@/lib/worlds/slug";

import { rememberWorld } from "./recent-worlds";

const INVALID_WORLD_MESSAGE =
  "Geçerli bir dünya adı ya da /w/ bağlantısı gir.";

export function JoinWorldForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setValue(event.target.value);
    if (error) setError(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const slug = normalizeWorldSlug(value);
    if (!slug) {
      setError(INVALID_WORLD_MESSAGE);
      inputRef.current?.focus();
      return;
    }

    setError(null);
    setPending(true);
    rememberWorld({ slug, name: worldTitleFromSlug(slug) });
    router.push(`/w/${slug}`);
  }

  return (
    <section
      id="katil"
      aria-labelledby="join-world-heading"
      className="shell scroll-mt-24 py-16 sm:py-20"
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-16">
        <div>
          <h2
            id="join-world-heading"
            className="font-display text-3xl font-semibold tracking-[-0.02em] text-[color:var(--foreground)] sm:text-4xl"
          >
            Elinde bir bağlantı mı var?
          </h2>
          <p className="mt-3 max-w-md text-base leading-relaxed text-[color:var(--muted)]">
            Dünya adını ya da tam bağlantıyı yapıştır, aynı tuvale katıl.
          </p>
        </div>

        <form
          className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5 sm:p-6"
          onSubmit={handleSubmit}
          noValidate
        >
          <label
            htmlFor="join-world"
            className="block text-sm font-semibold text-[color:var(--foreground)]"
          >
            Dünya adı ya da bağlantısı
          </label>

          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id="join-world"
              ref={inputRef}
              name="world"
              type="text"
              className="field flex-1"
              value={value}
              onChange={handleChange}
              placeholder="pembe-bulut-42"
              aria-describedby="join-world-help join-world-error"
              aria-invalid={error ? true : undefined}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="go"
            />
            <button
              type="submit"
              className="btn-primary sm:shrink-0"
              disabled={pending}
              aria-busy={pending || undefined}
            >
              Dünyaya gir
            </button>
          </div>

          <p
            id="join-world-help"
            className="mt-2 text-sm text-[color:var(--muted)]"
          >
            Tam bağlantıyı da yapıştırabilirsin.
          </p>
          <p
            id="join-world-error"
            className="min-h-5 text-sm font-medium text-[color:var(--danger)]"
            aria-live="polite"
          >
            {error}
          </p>
        </form>
      </div>
    </section>
  );
}
