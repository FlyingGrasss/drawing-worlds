import { useCallback, useState } from "react";

import type { Tool } from "@shared/world";

export interface DrawingSettings {
  tool: Tool;
  color: string;
  width: number;
}

export interface DrawingColor {
  value: string;
  label: string;
}

export interface WidthOption {
  label: string;
  value: number;
}

export const DEFAULT_DRAWING_SETTINGS: DrawingSettings = {
  tool: "pen",
  color: "#1f1b1a",
  width: 4,
};

export const DRAWING_COLORS = [
  { value: "#1f1b1a", label: "Siyah" },
  { value: "#7f1d1d", label: "Bordo" },
  { value: "#b91c1c", label: "Kırmızı" },
  { value: "#c2410c", label: "Turuncu" },
  { value: "#a16207", label: "Hardal" },
  { value: "#15803d", label: "Yeşil" },
  { value: "#0f766e", label: "Turkuaz" },
  { value: "#1d4ed8", label: "Mavi" },
  { value: "#6d28d9", label: "Mor" },
  { value: "#be123c", label: "Gül kurusu" },
] as const satisfies readonly DrawingColor[];

export const WIDTH_OPTIONS = [
  { label: "İnce", value: 2 },
  { label: "Orta", value: 4 },
  { label: "Kalın", value: 9 },
] as const satisfies readonly WidthOption[];

export type DrawingSettingsUpdate = (patch: Partial<DrawingSettings>) => void;

export function useDrawingSettings(): [DrawingSettings, DrawingSettingsUpdate] {
  const [settings, setSettings] = useState<DrawingSettings>({
    ...DEFAULT_DRAWING_SETTINGS,
  });

  const update = useCallback<DrawingSettingsUpdate>((patch) => {
    setSettings((current) => ({ ...current, ...patch }));
  }, []);

  return [settings, update];
}
