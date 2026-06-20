export function logServiceError(
  domain: string,
  operation: string,
  error: unknown,
): void {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[${domain}] ${operation}: ${message}`);
}
