import { Hono } from "hono";
import type Database from "better-sqlite3";
import { createCalendarRepository } from "../../database/calendarRepository";
import { broadcastChange } from "../broadcast";

export function createCalendarRoutes(db: Database.Database): Hono {
  const app = new Hono();
  const repo = createCalendarRepository(db);

  app.get("/", (c) => {
    return c.json(repo.fetchAll());
  });

  app.post("/", async (c) => {
    const body = await c.req.json();
    const { id, title, folderId } = body;
    if (
      typeof id !== "string" ||
      typeof title !== "string" ||
      typeof folderId !== "string"
    ) {
      return c.json(
        { error: "id, title, and folderId are required strings" },
        400,
      );
    }
    const result = repo.create(id, title, folderId);
    broadcastChange("calendar", "create", id);
    return c.json(result);
  });

  app.patch("/:id", async (c) => {
    const id = c.req.param("id");
    const updates = await c.req.json();
    const result = repo.update(id, updates);
    broadcastChange("calendar", "update", id);
    return c.json(result);
  });

  app.delete("/:id", (c) => {
    const id = c.req.param("id");
    repo.delete(id);
    broadcastChange("calendar", "delete", id);
    return c.json({ ok: true });
  });

  return app;
}
