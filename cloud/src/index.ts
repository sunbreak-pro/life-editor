import { Hono } from "hono";
import { cors } from "hono/cors";
import { authMiddleware } from "./middleware/auth";
import { auth } from "./routes/auth";
import { sync } from "./routes/sync";

export interface Env {
  DB: D1Database;
  SYNC_TOKEN: string;
}

const app = new Hono<{ Bindings: Env }>();

// CORS for Tauri WebView and local development
app.use(
  "*",
  cors({
    origin: [
      "tauri://localhost",
      "https://tauri.localhost",
      "http://localhost:1420",
      "http://localhost:5173",
    ],
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type"],
  }),
);

// Health check (no auth)
app.get("/health", (c) => c.json({ status: "ok" }));

// All API routes require auth
app.use("/auth/*", authMiddleware);
app.use("/sync/*", authMiddleware);

app.route("/auth", auth);
app.route("/sync", sync);

export default app;
