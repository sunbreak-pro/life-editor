export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function isTauriMobile(): boolean {
  return isTauri() && /iPhone|iPad|iPod/.test(navigator.userAgent);
}

let tauriCore: typeof import("@tauri-apps/api/core") | null = null;

export async function tauriInvoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!tauriCore) {
    tauriCore = await import("@tauri-apps/api/core");
  }
  return tauriCore.invoke<T>(cmd, args);
}
