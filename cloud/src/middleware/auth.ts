import type { Context, Next } from "hono";
import type { Env } from "../index";

/**
 * Constant-time string comparison via SHA-256 + Web Crypto timingSafeEqual.
 *
 * Hashing both sides first guarantees the two ArrayBuffers passed to
 * `crypto.subtle.timingSafeEqual` have identical lengths (a hard requirement)
 * regardless of input length, while still completing in constant time
 * relative to the secret. This avoids leaking the token's length or any
 * prefix-match information through `===` short-circuit timing.
 */
async function constantTimeStringEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [aHash, bHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  return crypto.subtle.timingSafeEqual(aHash, bHash);
}

export async function authMiddleware(
  c: Context<{ Bindings: Env }>,
  next: Next,
): Promise<Response | void> {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid Authorization header" }, 401);
  }

  const token = authHeader.slice(7);
  if (!(await constantTimeStringEqual(token, c.env.SYNC_TOKEN))) {
    return c.json({ error: "Invalid token" }, 401);
  }

  await next();
}
