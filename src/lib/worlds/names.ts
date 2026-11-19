interface WordPair {
  slug: string;
  label: string;
}

const ADJECTIVES: readonly WordPair[] = [
  { slug: "mavi", label: "Mavi" },
  { slug: "yesil", label: "Yeşil" },
  { slug: "altin", label: "Altın" },
  { slug: "gumus", label: "Gümüş" },
  { slug: "mor", label: "Mor" },
  { slug: "turkuaz", label: "Turkuaz" },
  { slug: "kirmizi", label: "Kırmızı" },
  { slug: "sakin", label: "Sakin" },
  { slug: "merakli", label: "Meraklı" },
  { slug: "parlak", label: "Parlak" },
  { slug: "gizemli", label: "Gizemli" },
  { slug: "sicak", label: "Sıcak" },
  { slug: "serin", label: "Serin" },
  { slug: "cesur", label: "Cesur" },
  { slug: "yumusak", label: "Yumuşak" },
  { slug: "derin", label: "Derin" },
];

const NOUNS: readonly WordPair[] = [
  { slug: "kedi", label: "Kedi" },
  { slug: "tilki", label: "Tilki" },
  { slug: "baykus", label: "Baykuş" },
  { slug: "geyik", label: "Geyik" },
  { slug: "balik", label: "Balık" },
  { slug: "kus", label: "Kuş" },
  { slug: "leylek", label: "Leylek" },
  { slug: "sincap", label: "Sincap" },
  { slug: "kaplumbaga", label: "Kaplumbağa" },
  { slug: "yunus", label: "Yunus" },
  { slug: "marti", label: "Martı" },
  { slug: "tavsan", label: "Tavşan" },
  { slug: "kelebek", label: "Kelebek" },
  { slug: "ahtapot", label: "Ahtapot" },
  { slug: "karga", label: "Karga" },
  { slug: "kertenkele", label: "Kertenkele" },
];

const LABELS = new Map<string, string>(
  [...ADJECTIVES, ...NOUNS].map((word) => [word.slug, word.label]),
);

export interface WorldName {
  slug: string;
  title: string;
}

function pick<T>(values: readonly T[], random: () => number): T {
  return values[Math.floor(random() * values.length)] ?? values[0]!;
}

function capitalize(value: string): string {
  if (!value) return value;
  const first = value.charAt(0).toLocaleUpperCase("tr-TR");
  return `${first}${value.slice(1)}`;
}

/** Random, URL-safe Turkish world slug, e.g. `mavi-tilki-482`. */
export function randomWorldSlug(random: () => number = Math.random): string {
  const adjective = pick(ADJECTIVES, random);
  const noun = pick(NOUNS, random);
  const suffix = 100 + Math.floor(random() * 900);
  return `${adjective.slug}-${noun.slug}-${suffix}`;
}

/** Human-readable title for slugs produced by `randomWorldSlug`. */
export function worldTitleFromSlug(slug: string): string {
  const parts = slug.trim().toLowerCase().split("-").filter(Boolean);
  if (parts.length === 0) return "";

  if (parts.length > 1 && /^\d+$/.test(parts[parts.length - 1] ?? "")) {
    parts.pop();
  }

  return parts
    .map((part) => LABELS.get(part) ?? capitalize(part))
    .join(" ");
}

export function createRandomWorld(random: () => number = Math.random): WorldName {
  const slug = randomWorldSlug(random);
  return { slug, title: worldTitleFromSlug(slug) };
}
