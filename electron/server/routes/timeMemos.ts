import { Hono } from "hono";
import type Database from "better-sqlite3";
import { createTimeMemoRepository } from "../../database/timeMemoRepository";
import { broadcastChange } from "../broadcast";

export function createTimeMemoRoutes(db: Database.Database): Hono {
  const app = new Hono();
  const repo = createTimeMemoRepository(db);

  app.get("/:date", (c) => {
    const date = c.req.param("date");
    return c.json(repo.fetchByDate(date));
  });

  app.put("/", async (c) => {
    const { id, date, hour, content } = await c.req.json<{
      id: string;
      date: string;
      hour: number;
      content: string;
    }>();
    const result = repo.upsert(id, date, hour, content);
    broadcastChange("timeMemo", "update", id);
    return c.json(result);
  });

  app.delete("/:id", (c) => {
    const id = c.req.param("id");
    repo.delete(id);
    broadcastChange("timeMemo", "delete", id);
    return c.json({ ok: true });
  });

  return app;
}
