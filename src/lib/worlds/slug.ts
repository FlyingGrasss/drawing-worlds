import { isValidWorldSlug } from "@shared/world";

/**
 * Accepts a bare slug, `/w/<slug>`, or a full URL ending in `/w/<slug>`.
 * Returns the canonical lowercase slug, or null for anything else.
 */
export function normalizeWorldSlug(input: string): string | null {
  if (typeof input !== "string") return null;

  let value = input.trim();
  if (!value) return null;

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value) || value.startsWith("//")) {
    try {
      const url = new URL(value, "https://placeholder.invalid");
      value = url.pathname;
    } catch {
      return null;
    }
  } else {
    value = value.split(/[?#]/, 1)[0] ?? "";
  }

  const worldPath = value.match(/(?:^|\/)w\/([^/]+)\/?$/i);
  if (worldPath?.[1]) {
    value = worldPath[1];
  } else {
    const segments = value.split("/").filter(Boolean);
    if (segments.length !== 1) return null;
    value = segments[0] ?? "";
  }

  try {
    value = decodeURIComponent(value);
  } catch {
    return null;
  }

  value = value.toLowerCase();
  return isValidWorldSlug(value) ? value : null;
}
