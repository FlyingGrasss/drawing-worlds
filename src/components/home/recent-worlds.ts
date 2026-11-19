import { isValidWorldSlug } from "@shared/world";

export interface RecentWorld {
  slug: string;
  name: string;
  at: number;
}

export const RECENT_WORLDS_KEY = "drawing-worlds:recent";

const MAX_RECENT_WORLDS = 8;
const MAX_STORED_ENTRIES = 50;

function isRecentWorld(value: unknown): value is RecentWorld {
  if (typeof value !== "object" || value === null) return false;

  const entry = value as Record<string, unknown>;
  return (
    typeof entry.slug === "string" &&
    isValidWorldSlug(entry.slug) &&
    typeof entry.name === "string" &&
    typeof entry.at === "number" &&
    Number.isFinite(entry.at)
  );
}

function sanitizeName(name: string, slug: string): string {
  return name.trim() || slug;
}

export function readRecentWorlds(): RecentWorld[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(RECENT_WORLDS_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const seen = new Set<string>();
    const worlds: RecentWorld[] = [];

    for (const entry of parsed.slice(0, MAX_STORED_ENTRIES)) {
      if (!isRecentWorld(entry) || seen.has(entry.slug)) continue;
      seen.add(entry.slug);
      worlds.push({
        slug: entry.slug,
        name: sanitizeName(entry.name, entry.slug),
        at: entry.at,
      });
    }

    return worlds
      .sort((left, right) => right.at - left.at)
      .slice(0, MAX_RECENT_WORLDS);
  } catch {
    return [];
  }
}

export function rememberWorld(world: { slug: string; name: string }): void {
  if (typeof window === "undefined" || !isValidWorldSlug(world.slug)) return;

  try {
    const entry: RecentWorld = {
      slug: world.slug,
      name: sanitizeName(world.name, world.slug),
      at: Date.now(),
    };

    const next = [
      entry,
      ...readRecentWorlds().filter((item) => item.slug !== entry.slug),
    ].slice(0, MAX_RECENT_WORLDS);

    window.localStorage.setItem(RECENT_WORLDS_KEY, JSON.stringify(next));
  } catch {
    // Storage can be unavailable (private mode, disabled cookies). Recents are optional.
    return;
  }
}

export function formatRecentTime(at: number): string {
  const elapsed = Date.now() - at;

  if (elapsed < 60_000) return "az önce";

  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) return `${minutes} dk önce`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} saat önce`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} gün önce`;

  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(at);
}
