import { Hono } from "hono";
import type Database from "better-sqlite3";
import { createPlaylistRepository } from "../../database/playlistRepository";
import { broadcastChange } from "../broadcast";

export function createPlaylistRoutes(db: Database.Database): Hono {
  const app = new Hono();
  const repo = createPlaylistRepository(db);

  app.get("/", (c) => {
    return c.json(repo.fetchAll());
  });

  app.post("/", async (c) => {
    const body = await c.req.json();
    const { id, name } = body;
    if (typeof id !== "string" || typeof name !== "string") {
      return c.json({ error: "id and name are required strings" }, 400);
    }
    const result = repo.create(id, name);
    broadcastChange("playlist", "create", id);
    return c.json(result);
  });

  app.patch("/:id", async (c) => {
    const id = c.req.param("id");
    const updates = await c.req.json();
    const result = repo.update(id, updates);
    broadcastChange("playlist", "update", id);
    return c.json(result);
  });

  app.delete("/:id", (c) => {
    const id = c.req.param("id");
    repo.delete(id);
    broadcastChange("playlist", "delete", id);
    return c.json({ ok: true });
  });

  app.get("/:id/items", (c) => {
    const id = c.req.param("id");
    return c.json(repo.fetchItems(id));
  });

  app.get("/items/all", (c) => {
    return c.json(repo.fetchAllItems());
  });

  app.post("/:id/items", async (c) => {
    const playlistId = c.req.param("id");
    const body = await c.req.json();
    const { id, soundId } = body;
    if (typeof id !== "string" || typeof soundId !== "string") {
      return c.json({ error: "id and soundId are required strings" }, 400);
    }
    const result = repo.addItem(id, playlistId, soundId);
    broadcastChange("playlistItem", "create", id);
    return c.json(result);
  });

  app.delete("/items/:itemId", (c) => {
    const itemId = c.req.param("itemId");
    repo.removeItem(itemId);
    broadcastChange("playlistItem", "delete", itemId);
    return c.json({ ok: true });
  });

  app.put("/:playlistId/items/reorder", async (c) => {
    const playlistId = c.req.param("playlistId");
    const { itemIds } = await c.req.json<{ itemIds: string[] }>();
    repo.reorderItems(playlistId, itemIds);
    broadcastChange("playlistItem", "update", playlistId);
    return c.json({ ok: true });
  });

  return app;
}
