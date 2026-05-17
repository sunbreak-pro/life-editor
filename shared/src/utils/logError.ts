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
 * Supabase/postgrest rejections are `Error`-shaped, but a defensive
 * fallback keeps a non-Error throw (string / object) from collapsing to
 * the useless "[object Object]".
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === "string") return error || fallback;
  if (error == null) return fallback;
  const text = String(error);
  return text && text !== "[object Object]" ? text : fallback;
}
