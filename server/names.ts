import { PRESENCE_PALETTE, type Presence } from "../shared/world.js";

const ADJECTIVES = [
  "Meraklı",
  "Sakin",
  "Cesur",
  "Gizemli",
  "Neşeli",
  "Yorgun",
  "Hızlı",
  "Sessiz",
  "Parlak",
  "Uykucu",
  "Kıvrak",
  "Gözlemci",
  "Cömert",
  "Sabırlı",
  "Yaratıcı",
  "Dalgın",
] as const;

const NOUNS = [
  "Tilki",
  "Kedi",
  "Baykuş",
  "Leylek",
  "Sincap",
  "Balık",
  "Karga",
  "Kertenkele",
  "Arı",
  "Martı",
  "Geyik",
  "Ahtapot",
  "Kelebek",
  "Yunus",
  "Tavşan",
  "Kaplumbağa",
] as const;

function pick<T>(values: readonly T[]): T {
  return values[Math.floor(Math.random() * values.length)] ?? values[0]!;
}

export function randomPresenceName(taken: ReadonlySet<string> = new Set<string>()): string {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const candidate = `${pick(ADJECTIVES)} ${pick(NOUNS)}`;
    if (!taken.has(candidate)) return candidate;
  }

  const base = `${pick(ADJECTIVES)} ${pick(NOUNS)}`;
  let suffix = 2;
  while (taken.has(`${base} ${suffix}`)) suffix += 1;
  return `${base} ${suffix}`;
}

export function pickPresenceColor(
  taken: ReadonlySet<string> = new Set<string>(),
): string {
  const free = PRESENCE_PALETTE.filter((color) => !taken.has(color));
  const pool = free.length > 0 ? free : PRESENCE_PALETTE;
  return pick(pool);
}

export function createPresence(
  clientId: string,
  taken: { names?: ReadonlySet<string>; colors?: ReadonlySet<string> } = {},
): Presence {
  return {
    clientId,
    name: randomPresenceName(taken.names),
    color: pickPresenceColor(taken.colors),
    cursor: null,
  };
}
