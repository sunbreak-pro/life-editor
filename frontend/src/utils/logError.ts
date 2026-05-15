export function logServiceError(
  domain: string,
  operation: string,
  error: unknown,
): void {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[${domain}] ${operation}: ${message}`);
}

/**
 * Extract a human-readable message from an unknown thrown value.
 *
 * Tauri's `invoke()` rejects with a plain string (the Rust `Err(String)`),
 * never an `Error` instance — so an `e instanceof Error ? e.message : fallback`
 * check silently discards the real backend error. Use this everywhere a
 * Tauri/IPC rejection is surfaced to the user.
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === "string") return error || fallback;
  if (error == null) return fallback;
  const text = String(error);
  return text && text !== "[object Object]" ? text : fallback;
}
