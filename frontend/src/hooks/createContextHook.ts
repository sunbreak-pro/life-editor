import { useContext, type Context } from "react";

export function createContextHook<T>(
  context: Context<T | null>,
  name: string,
): () => T {
  return () => {
    const value = useContext(context);
    if (!value) throw new Error(`${name} must be used within its Provider`);
    return value;
  };
}
