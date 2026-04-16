import type { Context, Next } from "hono";
import type { Env } from "../index";

export async function authMiddleware(
  c: Context<{ Bindings: Env }>,
  next: Next,
): Promise<Response | void> {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid Authorization header" }, 401);
  }

  const token = authHeader.slice(7);
  if (token !== c.env.SYNC_TOKEN) {
    return c.json({ error: "Invalid token" }, 401);
  }

  await next();
}
