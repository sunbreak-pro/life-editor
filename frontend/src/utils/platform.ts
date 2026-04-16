export const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);

export const modSymbol = isMac ? "⌘" : "Ctrl";

export const modKey = isMac ? "⌘" : "Ctrl+";

export function formatShortcut(mac: string, win: string): string {
  return isMac ? mac : win;
}
