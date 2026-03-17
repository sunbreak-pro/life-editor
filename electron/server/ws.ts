import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { getActiveToken } from "./middleware/auth";
import { changeBus, type ChangeEvent } from "./broadcast";
import log from "../logger";

const PING_INTERVAL_MS = 30_000;

export function setupWebSocket(httpServer: Server): () => void {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    if (url.pathname !== "/ws") {
      socket.destroy();
      return;
    }

    const token = url.searchParams.get("token");
    const activeToken = getActiveToken();

    if (!activeToken || token !== activeToken) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (ws) => {
    log.info("[WS] Client connected");

    let alive = true;

    ws.on("pong", () => {
      alive = true;
    });

    ws.on("close", () => {
      log.info("[WS] Client disconnected");
    });

    ws.on("error", (err) => {
      log.error("[WS] Client error:", err);
    });

    const pingTimer = setInterval(() => {
      if (!alive) {
        ws.terminate();
        return;
      }
      alive = false;
      ws.ping();
    }, PING_INTERVAL_MS);

    ws.on("close", () => {
      clearInterval(pingTimer);
    });
  });

  const onChange = (event: ChangeEvent) => {
    const message = JSON.stringify(event);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  };

  changeBus.on("change", onChange);

  log.info("[WS] WebSocket server attached to HTTP server");

  return () => {
    changeBus.off("change", onChange);
    wss.close();
  };
}
