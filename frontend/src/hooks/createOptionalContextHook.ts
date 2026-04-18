import { useContext, type Context } from "react";

export function createOptionalContextHook<T>(
  context: Context<T | null>,
): () => T | null {
  return () => useContext(context);
}
