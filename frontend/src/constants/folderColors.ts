export const FOLDER_COLORS = [
  // === Pastel (10) ===
  "#E8D5F5", // lavender
  "#D5E8F5", // sky blue
  "#D5F5E8", // mint
  "#F5E8D5", // peach
  "#F5D5E8", // pink
  "#E8F5D5", // lime
  "#F5F0D5", // yellow
  "#D5F5F0", // teal
  "#F5D5D5", // rose
  "#D5D5F5", // periwinkle
  // === Vivid (10) ===
  "#D8B4FE", // violet
  "#93C5FD", // blue
  "#6EE7B7", // emerald
  "#FDBA74", // orange
  "#F9A8D4", // pink
  "#BEF264", // lime
  "#FDE047", // yellow
  "#5EEAD4", // teal
  "#FCA5A5", // red
  "#A5B4FC", // indigo
] as const;

export const FOLDER_COLORS_TEXT = [
  // === Pastel (10) ===
  "#7C3AED", // lavender
  "#2563EB", // sky blue
  "#059669", // mint
  "#D97706", // peach
  "#DB2777", // pink
  "#65A30D", // lime
  "#CA8A04", // yellow
  "#0D9488", // teal
  "#DC2626", // rose
  "#4F46E5", // periwinkle
  // === Vivid (10) ===
  "#6D28D9", // violet
  "#1D4ED8", // blue
  "#047857", // emerald
  "#C2410C", // orange
  "#BE185D", // pink
  "#4D7C0F", // lime
  "#A16207", // yellow
  "#0F766E", // teal
  "#B91C1C", // red
  "#4338CA", // indigo
] as const;

export function getColorByIndex(index: number): string {
  return FOLDER_COLORS[index % FOLDER_COLORS.length];
}

export function getTextColorByIndex(index: number): string {
  return FOLDER_COLORS_TEXT[index % FOLDER_COLORS_TEXT.length];
}

// Unified preset colors for color pickers
export const DEFAULT_PRESET_COLORS = [
  "#E03E3E",
  "#2EAADC",
  "#0F7B6C",
  "#DFAB01",
  "#6B7280",
] as const;

// Compute contrast color (white or black) based on luminance
export function computeContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#18181b" : "#f4f4f5";
}

export function getTextColorForBg(bgColor: string): string {
  const idx = FOLDER_COLORS.indexOf(bgColor as (typeof FOLDER_COLORS)[number]);
  return idx >= 0 ? FOLDER_COLORS_TEXT[idx] : computeContrastColor(bgColor);
}
