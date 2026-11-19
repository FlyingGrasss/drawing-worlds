export default function WorldLoading() {
  return (
    <div className="flex min-h-[100dvh] flex-col" aria-busy="true">
      <span className="sr-only">Dünya yükleniyor…</span>

      <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="shell flex flex-wrap items-center gap-x-5 gap-y-2.5 py-3">
          <div
            aria-hidden="true"
            className="h-5 w-20 animate-pulse rounded bg-[color:var(--surface-subtle)]"
          />
          <div className="min-w-0 flex-1 basis-52">
            <div
              aria-hidden="true"
              className="h-5 w-40 animate-pulse rounded bg-[color:var(--surface-subtle)]"
            />
            <div
              aria-hidden="true"
              className="mt-2 h-3 w-64 max-w-full animate-pulse rounded bg-[color:var(--surface-subtle)]"
            />
          </div>
          <div
            aria-hidden="true"
            className="h-9 w-56 animate-pulse rounded-full bg-[color:var(--surface-subtle)]"
          />
        </div>
      </header>

      <main
        id="main"
        className="shell flex w-full flex-1 flex-col py-4 sm:py-6"
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <div
              aria-hidden="true"
              className="aspect-square w-full max-w-[min(100%,72vh)] animate-pulse rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)]"
            />
          </div>
          <div
            aria-hidden="true"
            className="mx-auto mt-4 h-12 w-full max-w-xl animate-pulse rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)]"
          />
        </div>
      </main>
    </div>
  );
}
