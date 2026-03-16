import type { MiddlewareHandler } from "hono";
import crypto from "crypto";

let activeToken: string | null = null;

export function generateToken(): string {
  activeToken = crypto.randomBytes(32).toString("hex");
  return activeToken;
}

export function getActiveToken(): string | null {
  return activeToken;
}

export function revokeToken(): void {
  activeToken = null;
}

export function setToken(token: string): void {
  activeToken = token;
}

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  if (!activeToken) {
    return c.json({ error: "Mobile access is not enabled" }, 403);
  }

  // Allow token via query param (for initial QR code connection)
  const queryToken = c.req.query("token");
  const headerToken = c.req.header("Authorization")?.replace("Bearer ", "");

  const token = headerToken || queryToken;

  if (token !== activeToken) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
};
