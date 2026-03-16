import { Hono } from "hono";
import type Database from "better-sqlite3";
import { createMemoRepository } from "../../database/memoRepository";
import { broadcastChange } from "../broadcast";

export function createMemoRoutes(db: Database.Database): Hono {
  const app = new Hono();
  const repo = createMemoRepository(db);

  app.get("/", (c) => {
    return c.json(repo.fetchAll());
  });

  app.get("/deleted", (c) => {
    return c.json(repo.fetchDeleted());
  });

  app.get("/:date", (c) => {
    const date = c.req.param("date");
    const memo = repo.fetchByDate(date);
    if (!memo) return c.json(null);
    return c.json(memo);
  });

  app.put("/:date", async (c) => {
    const date = c.req.param("date");
    const { content } = await c.req.json<{ content: string }>();
    const result = repo.upsert(date, content);
    broadcastChange("memo", "update", date);
    return c.json(result);
  });

  app.delete("/:date", (c) => {
    const date = c.req.param("date");
    repo.delete(date);
    broadcastChange("memo", "delete", date);
    return c.json({ ok: true });
  });

  app.post("/:date/restore", (c) => {
    const date = c.req.param("date");
    repo.restore(date);
    broadcastChange("memo", "update", date);
    return c.json({ ok: true });
  });

  app.delete("/:date/permanent", (c) => {
    const date = c.req.param("date");
    repo.permanentDelete(date);
    broadcastChange("memo", "delete", date);
    return c.json({ ok: true });
  });

  app.post("/:date/toggle-pin", (c) => {
    const date = c.req.param("date");
    const result = repo.togglePin(date);
    broadcastChange("memo", "update", date);
    return c.json(result);
  });

  return app;
}
