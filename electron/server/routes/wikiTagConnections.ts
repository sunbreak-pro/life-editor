import { Hono } from "hono";
import type Database from "better-sqlite3";
import { createWikiTagConnectionRepository } from "../../database/wikiTagConnectionRepository";
import { broadcastChange } from "../broadcast";

export function createWikiTagConnectionRoutes(db: Database.Database): Hono {
  const app = new Hono();
  const repo = createWikiTagConnectionRepository(db);

  app.get("/", (c) => {
    return c.json(repo.fetchAll());
  });

  app.post("/", async (c) => {
    const { sourceTagId, targetTagId } = await c.req.json<{
      sourceTagId: string;
      targetTagId: string;
    }>();
    const result = repo.create(sourceTagId, targetTagId);
    broadcastChange("wikiTagConnection", "create", result.id);
    return c.json(result);
  });

  app.delete("/:id", (c) => {
    const id = c.req.param("id");
    repo.delete(id);
    broadcastChange("wikiTagConnection", "delete", id);
    return c.json({ ok: true });
  });

  app.post("/delete-by-pair", async (c) => {
    const { sourceTagId, targetTagId } = await c.req.json<{
      sourceTagId: string;
      targetTagId: string;
    }>();
    repo.deleteByTagPair(sourceTagId, targetTagId);
    broadcastChange("wikiTagConnection", "delete");
    return c.json({ ok: true });
  });

  return app;
}
