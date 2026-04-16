import { Hono } from "hono";
import type { Env } from "../index";

const auth = new Hono<{ Bindings: Env }>();

auth.post("/verify", (c) => {
  return c.json({
    valid: true,
    serverTime: new Date().toISOString(),
  });
});

export { auth };
