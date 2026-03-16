import { Hono } from "hono";
import type Database from "better-sqlite3";
import { createNoteRepository } from "../../database/noteRepository";
import { broadcastChange } from "../broadcast";

export function createNoteRoutes(db: Database.Database): Hono {
  const app = new Hono();
  const repo = createNoteRepository(db);

  app.get("/", (c) => {
    return c.json(repo.fetchAll());
  });

  app.get("/deleted", (c) => {
    return c.json(repo.fetchDeleted());
  });

  app.get("/search", (c) => {
    const query = c.req.query("q") || "";
    return c.json(repo.search(query));
  });

  app.get("/:id", (c) => {
    const id = c.req.param("id");
    const all = repo.fetchAll();
    const note = all.find((n) => n.id === id);
    if (!note) return c.json({ error: "Not found" }, 404);
    return c.json(note);
  });

  app.post("/", async (c) => {
    const { id, title } = await c.req.json<{ id: string; title: string }>();
    const result = repo.create(id, title);
    broadcastChange("note", "create", id);
    return c.json(result, 201);
  });

  app.patch("/:id", async (c) => {
    const id = c.req.param("id");
    const updates = await c.req.json<{
      title?: string;
      content?: string;
      isPinned?: boolean;
      color?: string;
    }>();
    const result = repo.update(id, updates);
    broadcastChange("note", "update", id);
    return c.json(result);
  });

  app.delete("/:id", (c) => {
    const id = c.req.param("id");
    repo.softDelete(id);
    broadcastChange("note", "delete", id);
    return c.json({ ok: true });
  });

  app.post("/:id/restore", (c) => {
    const id = c.req.param("id");
    repo.restore(id);
    broadcastChange("note", "update", id);
    return c.json({ ok: true });
  });

  app.delete("/:id/permanent", (c) => {
    const id = c.req.param("id");
    repo.permanentDelete(id);
    broadcastChange("note", "delete", id);
    return c.json({ ok: true });
  });

  return app;
}
