import { Hono } from "hono";
import { createServer, type Server } from "http";
import * as fs from "fs";
import * as path from "path";
import type Database from "better-sqlite3";
import log from "../logger";
import { corsMiddleware } from "./middleware/cors";
import { authMiddleware } from "./middleware/auth";
import { createMemoRoutes } from "./routes/memos";
import { createNoteRoutes } from "./routes/notes";
import { createWikiTagRoutes } from "./routes/wikiTags";
import { createTaskRoutes } from "./routes/tasks";
import { createScheduleItemRoutes } from "./routes/scheduleItems";
import { createRoutineRoutes } from "./routes/routines";

const SERVER_PORT = 13456;

let server: Server | null = null;

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
};

export function createApiApp(db: Database.Database): Hono {
  const app = new Hono();

  // Global middleware
  app.use("*", corsMiddleware);

  // Health check (no auth required)
  app.get("/api/health", (c) => {
    return c.json({ status: "ok", version: "1.0.0" });
  });

  // All API routes require auth
  app.use("/api/*", authMiddleware);

  // Mount route modules
  app.route("/api/memos", createMemoRoutes(db));
  app.route("/api/notes", createNoteRoutes(db));
  app.route("/api/wiki-tags", createWikiTagRoutes(db));
  app.route("/api/tasks", createTaskRoutes(db));
  app.route("/api/schedule-items", createScheduleItemRoutes(db));
  app.route("/api/routines", createRoutineRoutes(db));

  return app;
}

function getStaticDir(): string {
  // In packaged app: <app>/frontend/dist
  // In dev: <project>/frontend/dist
  const appDir = process.env.APP_PATH || path.join(__dirname, "..", "..");
  return path.join(appDir, "frontend", "dist");
}

function serveStatic(
  req: import("http").IncomingMessage,
  res: import("http").ServerResponse,
): boolean {
  const staticDir = getStaticDir();
  if (!fs.existsSync(staticDir)) return false;

  let urlPath = (req.url || "/").split("?")[0];

  // Try exact file match, then fallback to index.html (SPA)
  let filePath = path.join(staticDir, urlPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const mimeType = MIME_TYPES[ext] || "application/octet-stream";
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { "Content-Type": mimeType });
    res.end(content);
    return true;
  }

  // SPA fallback: serve index.html for non-API, non-file routes
  const indexPath = path.join(staticDir, "index.html");
  if (fs.existsSync(indexPath)) {
    const content = fs.readFileSync(indexPath);
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(content);
    return true;
  }

  return false;
}

export function startServer(db: Database.Database): Promise<Server> {
  return new Promise((resolve, reject) => {
    const app = createApiApp(db);

    server = createServer((req, res) => {
      const url = req.url || "/";

      // API requests go through Hono
      if (url.startsWith("/api/")) {
        const reqInit: Record<string, unknown> = {
          method: req.method,
          headers: req.headers as unknown as Record<string, string>,
        };
        if (req.method !== "GET" && req.method !== "HEAD") {
          reqInit.body = req as unknown as ReadableStream;
          reqInit.duplex = "half";
        }
        const fetchReq = new Request(
          `http://localhost:${SERVER_PORT}${url}`,
          reqInit as RequestInit,
        );
        Promise.resolve(app.fetch(fetchReq))
          .then((response: Response) => {
            res.writeHead(
              response.status,
              Object.fromEntries(response.headers),
            );
            if (response.body) {
              const reader = response.body.getReader();
              const pump = (): Promise<void> =>
                reader
                  .read()
                  .then(
                    ({
                      done,
                      value,
                    }: {
                      done: boolean;
                      value?: Uint8Array;
                    }) => {
                      if (done) {
                        res.end();
                        return;
                      }
                      res.write(value);
                      return pump();
                    },
                  );
              pump().catch(() => res.end());
            } else {
              res.end();
            }
          })
          .catch((err: Error) => {
            log.error("[Server] Request handling error:", err);
            res.writeHead(500);
            res.end("Internal Server Error");
          });
        return;
      }

      // Static file serving for PWA
      if (!serveStatic(req, res)) {
        res.writeHead(404);
        res.end("Not Found");
      }
    });

    server.listen(SERVER_PORT, "0.0.0.0", () => {
      log.info(
        `[Server] HTTP server listening on http://0.0.0.0:${SERVER_PORT}`,
      );
      resolve(server!);
    });

    server.on("error", (err) => {
      log.error("[Server] Failed to start:", err);
      reject(err);
    });
  });
}

export function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!server) {
      resolve();
      return;
    }
    server.close(() => {
      log.info("[Server] HTTP server stopped");
      server = null;
      resolve();
    });
  });
}

export function getServerPort(): number {
  return SERVER_PORT;
}
