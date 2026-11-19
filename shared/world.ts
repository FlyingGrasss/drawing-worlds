export type Point = [number, number];

export type Tool = "pen" | "eraser";

export interface Stroke {
  id: string;
  authorId: string;
  tool: Tool;
  color: string;
  width: number;
  points: Point[];
  createdAt: number;
}

export interface Presence {
  clientId: string;
  name: string;
  color: string;
  cursor: Point | null;
}

export const WORLD_SIZE = 2048;

const WORLD_SLUG_PATTERN = /^[a-z0-9-]{1,40}$/;

export function isValidWorldSlug(value: unknown): value is string {
  return typeof value === "string" && WORLD_SLUG_PATTERN.test(value);
}

export const PAPER_COLOR = "#faf9f5";
export const ERASER_COLOR = PAPER_COLOR;

export const INK_PALETTE = [
  "#1c1917",
  "#7f1d1d",
  "#1d4ed8",
  "#047857",
  "#b45309",
  "#6d28d9",
  "#be123c",
  "#0f766e",
] as const;

export const PRESENCE_PALETTE = [
  "#e11d48",
  "#2563eb",
  "#059669",
  "#d97706",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#65a30d",
  "#dc2626",
  "#0d9488",
  "#9333ea",
  "#ca8a04",
  "#4f46e5",
  "#16a34a",
  "#ea580c",
  "#0284c7",
] as const;

export const MIN_STROKE_WIDTH = 1;
export const MAX_STROKE_WIDTH = 64;

export interface WorldLimits {
  maxClientsPerWorld: number;
  maxStrokesPerWorld: number;
  maxPointsPerStroke: number;
  maxPointsPerWorld: number;
  maxPointsPerAppend: number;
  maxMessageBytes: number;
}

export const LIMITS: WorldLimits = {
  maxClientsPerWorld: 30,
  maxStrokesPerWorld: 1000,
  maxPointsPerStroke: 2000,
  maxPointsPerWorld: 120_000,
  maxPointsPerAppend: 32,
  maxMessageBytes: 24 * 1024,
};

export function isTool(value: unknown): value is Tool {
  return value === "pen" || value === "eraser";
}

export function isPoint(value: unknown): value is Point {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "number" &&
    Number.isFinite(value[0]) &&
    value[0] >= 0 &&
    value[0] <= WORLD_SIZE &&
    typeof value[1] === "number" &&
    Number.isFinite(value[1]) &&
    value[1] >= 0 &&
    value[1] <= WORLD_SIZE
  );
}

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

export function isStrokeId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value);
}

export function isStrokeWidth(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= MIN_STROKE_WIDTH &&
    value <= MAX_STROKE_WIDTH
  );
}
