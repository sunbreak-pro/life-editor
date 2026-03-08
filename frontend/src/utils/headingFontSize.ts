import { STORAGE_KEYS } from "../constants/storageKeys";

type HeadingLevel = 1 | 2 | 3;

function readStore(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.HEADING_FONT_SIZES);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getStoredHeadingFontSize(level: HeadingLevel): string | null {
  return readStore()[String(level)] ?? null;
}

export function setStoredHeadingFontSize(
  level: HeadingLevel,
  fontSize: string,
): void {
  const store = readStore();
  store[String(level)] = fontSize;
  localStorage.setItem(STORAGE_KEYS.HEADING_FONT_SIZES, JSON.stringify(store));
}
