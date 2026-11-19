export function CanvasPreview() {
  return (
    <figure className="mx-auto w-full max-w-[34rem] lg:mx-0">
      <div className="overflow-hidden rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--surface)]">
        <div className="flex items-center justify-between gap-3 border-b border-[color:var(--border)] px-4 py-2.5">
          <span className="flex shrink-0 items-center gap-1.5" aria-hidden="true">
            <span className="h-2 w-2 rounded-full bg-[#e9ddd5]" />
            <span className="h-2 w-2 rounded-full bg-[#e9ddd5]" />
            <span className="h-2 w-2 rounded-full bg-[#e9ddd5]" />
          </span>
          <span className="truncate text-xs font-medium text-[color:var(--muted)]">
            pembe-bulut-42
          </span>
          <span className="shrink-0 rounded-full border border-[color:var(--border)] px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)]">
            örnek
          </span>
        </div>

        <svg
          viewBox="0 0 560 400"
          className="block h-auto w-full"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <pattern
              id="canvas-dots"
              width="22"
              height="22"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="1.5" cy="1.5" r="1.1" fill="#eadfd8" />
            </pattern>
          </defs>

          <rect width="560" height="400" fill="#fffdf8" />
          <rect width="560" height="400" fill="url(#canvas-dots)" />

          <path
            d="M0 350c74-26 138 10 212-8 78-19 144-14 348 12v46H0Z"
            fill="#ecfdf5"
          />
          <path
            d="M0 350c74-26 138 10 212-8 78-19 144-14 348 12"
            fill="none"
            stroke="#86efac"
            strokeWidth="3"
            strokeLinecap="round"
          />

          <g stroke="#f59e0b" strokeWidth="4" strokeLinecap="round">
            <path d="M110 42v12" />
            <path d="M110 130v12" />
            <path d="M60 92h-12" />
            <path d="M160 92h12" />
            <path d="m75 57-9-9" />
            <path d="m145 127 9 9" />
            <path d="m145 57 9-9" />
            <path d="m75 127-9 9" />
          </g>
          <circle
            cx="110"
            cy="92"
            r="28"
            fill="#fde68a"
            stroke="#d97706"
            strokeWidth="3"
          />
          <circle cx="101" cy="88" r="2.5" fill="#92400e" />
          <circle cx="119" cy="88" r="2.5" fill="#92400e" />
          <path
            d="M101 98c5 6 13 6 18 0"
            fill="none"
            stroke="#92400e"
            strokeWidth="3"
            strokeLinecap="round"
          />

          <path
            d="M46 292c38-34 66 24 102 2 34-21 44-58 84-46 30 9 34 42 66 34"
            fill="none"
            stroke="#2563eb"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path
            d="M58 318c28 12 52-10 80-2"
            fill="none"
            stroke="#93c5fd"
            strokeWidth="3"
            strokeLinecap="round"
          />

          <g>
            <path
              d="M432 250c-2-28 2-48 0-74"
              fill="none"
              stroke="#15803d"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d="M432 216c-18-4-30-16-28-30 16 2 26 12 28 30Z"
              fill="#bbf7d0"
              stroke="#15803d"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d="M432 230c16-4 25-14 24-27-14 1-23 11-24 27Z"
              fill="#bbf7d0"
              stroke="#15803d"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <g fill="#fecdd3" stroke="#e11d48" strokeWidth="2.5">
              <circle cx="432" cy="124" r="15" />
              <circle cx="452" cy="136" r="15" />
              <circle cx="452" cy="158" r="15" />
              <circle cx="432" cy="170" r="15" />
              <circle cx="412" cy="158" r="15" />
              <circle cx="412" cy="136" r="15" />
            </g>
            <circle
              cx="432"
              cy="147"
              r="12"
              fill="#fbbf24"
              stroke="#d97706"
              strokeWidth="2"
            />
          </g>

          <g transform="translate(260 190)">
            <path
              d="M-30-26-22-48-8-34"
              fill="#fffdf8"
              stroke="#1f1b1a"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            <path
              d="M30-26 22-48 8-34"
              fill="#fffdf8"
              stroke="#1f1b1a"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            <circle
              r="38"
              fill="#fffdf8"
              stroke="#1f1b1a"
              strokeWidth="3.5"
            />
            <circle cx="-13" cy="-6" r="3.5" fill="#1f1b1a" />
            <circle cx="13" cy="-6" r="3.5" fill="#1f1b1a" />
            <path d="M-5 7h10L0 13Z" fill="#e11d48" />
            <path
              d="M0 13c-2 4-7 5-11 3M0 13c2 4 7 5 11 3"
              fill="none"
              stroke="#1f1b1a"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M-40-2h-18M-39 5l-17 5M40-2h18M39 5l17 5"
              fill="none"
              stroke="#1f1b1a"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>

          <path
            d="M366 78l3.5 10 10 3.5-10 3.5-3.5 10-3.5-10-10-3.5 10-3.5Z"
            fill="#fbbf24"
          />
          <path
            d="M84 180l2.5 7 7 2.5-7 2.5-2.5 7-2.5-7-7-2.5 7-2.5Z"
            fill="#5eead4"
          />
          <path
            d="M492 80c-8-8-22-2-18 9 2 6 12 12 18 16 6-4 16-10 18-16 4-11-10-17-18-9Z"
            fill="#fecdd3"
            stroke="#e11d48"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />

          <g transform="translate(150 118)">
            <path
              d="M0 0v20l5.2-4.9 3.4 8 3.8-1.6-3.2-7.9H16Z"
              fill="#2563eb"
              stroke="#fffdf8"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <rect
              x="16"
              y="15"
              width="82"
              height="22"
              rx="11"
              fill="#2563eb"
            />
            <text
              x="57"
              y="30"
              textAnchor="middle"
              fill="#ffffff"
              fontSize="10"
              fontWeight="600"
              fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
            >
              Arkadaşın
            </text>
          </g>

          <g transform="translate(338 246)">
            <path
              d="M0 0v20l5.2-4.9 3.4 8 3.8-1.6-3.2-7.9H16Z"
              fill="#e11d48"
              stroke="#fffdf8"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <rect x="16" y="15" width="46" height="22" rx="11" fill="#e11d48" />
            <text
              x="39"
              y="30"
              textAnchor="middle"
              fill="#ffffff"
              fontSize="11"
              fontWeight="600"
              fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
            >
              Sen
            </text>
          </g>
        </svg>
      </div>

      <figcaption className="sr-only">
        Örnek bir tuvalde iki kişinin birlikte çizdiği renkli desenler.
      </figcaption>
    </figure>
  );
}
