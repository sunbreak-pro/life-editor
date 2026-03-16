import { Hono } from "hono";
import type Database from "better-sqlite3";
import { createNoteConnectionRepository } from "../../database/noteConnectionRepository";
import { broadcastChange } from "../broadcast";

export function createNoteConnectionRoutes(db: Database.Database): Hono {
  const app = new Hono();
  const repo = createNoteConnectionRepository(db);

  app.get("/", (c) => {
    return c.json(repo.fetchAll());
  });

  app.post("/", async (c) => {
    const { sourceNoteId, targetNoteId } = await c.req.json<{
      sourceNoteId: string;
      targetNoteId: string;
    }>();
    const result = repo.create(sourceNoteId, targetNoteId);
    broadcastChange("noteConnection", "create", result.id);
    return c.json(result);
  });

  app.delete("/:id", (c) => {
    const id = c.req.param("id");
    repo.delete(id);
    broadcastChange("noteConnection", "delete", id);
    return c.json({ ok: true });
  });

  app.post("/delete-by-pair", async (c) => {
    const { sourceNoteId, targetNoteId } = await c.req.json<{
      sourceNoteId: string;
      targetNoteId: string;
    }>();
    repo.deleteByNotePair(sourceNoteId, targetNoteId);
    broadcastChange("noteConnection", "delete");
    return c.json({ ok: true });
  });

  return app;
}
