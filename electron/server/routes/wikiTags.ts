import { Hono } from "hono";
import type Database from "better-sqlite3";
import { createWikiTagRepository } from "../../database/wikiTagRepository";
import type { WikiTag } from "../../types";
import { broadcastChange } from "../broadcast";

export function createWikiTagRoutes(db: Database.Database): Hono {
  const app = new Hono();
  const repo = createWikiTagRepository(db);

  app.get("/", (c) => {
    return c.json(repo.fetchAll());
  });

  app.get("/search", (c) => {
    const query = c.req.query("q") || "";
    return c.json(repo.search(query));
  });

  app.get("/assignments", (c) => {
    return c.json(repo.fetchAllAssignments());
  });

  app.post("/", async (c) => {
    const { name, color } = await c.req.json<{ name: string; color: string }>();
    const result = repo.create(name, color);
    broadcastChange("wikiTag", "create", result.id);
    return c.json(result, 201);
  });

  app.post("/with-id", async (c) => {
    const { id, name, color } = await c.req.json<{
      id: string;
      name: string;
      color: string;
    }>();
    const result = repo.createWithId(id, name, color);
    broadcastChange("wikiTag", "create", id);
    return c.json(result, 201);
  });

  app.patch("/:id", async (c) => {
    const id = c.req.param("id");
    const updates =
      await c.req.json<
        Partial<Pick<WikiTag, "name" | "color" | "textColor">>
      >();
    const result = repo.update(id, updates);
    broadcastChange("wikiTag", "update", id);
    return c.json(result);
  });

  app.delete("/:id", (c) => {
    const id = c.req.param("id");
    repo.delete(id);
    broadcastChange("wikiTag", "delete", id);
    return c.json({ ok: true });
  });

  app.post("/merge", async (c) => {
    const { sourceId, targetId } = await c.req.json<{
      sourceId: string;
      targetId: string;
    }>();
    const result = repo.merge(sourceId, targetId);
    broadcastChange("wikiTag", "update", targetId);
    return c.json(result);
  });

  app.get("/entity/:entityId", (c) => {
    const entityId = c.req.param("entityId");
    return c.json(repo.fetchTagsForEntity(entityId));
  });

  app.put("/entity/:entityId", async (c) => {
    const entityId = c.req.param("entityId");
    const { entityType, tagIds } = await c.req.json<{
      entityType: string;
      tagIds: string[];
    }>();
    repo.setTagsForEntity(entityId, entityType, tagIds);
    broadcastChange("wikiTagAssignment", "update", entityId);
    return c.json({ ok: true });
  });

  app.post("/entity/:entityId/sync-inline", async (c) => {
    const entityId = c.req.param("entityId");
    const { entityType, tagNames } = await c.req.json<{
      entityType: string;
      tagNames: string[];
    }>();
    repo.syncInlineTags(entityId, entityType, tagNames);
    broadcastChange("wikiTagAssignment", "update", entityId);
    return c.json({ ok: true });
  });

  app.post("/restore-assignment", async (c) => {
    const { tagId, entityId, entityType, source } = await c.req.json<{
      tagId: string;
      entityId: string;
      entityType: string;
      source: string;
    }>();
    repo.restoreAssignment(tagId, entityId, entityType, source);
    broadcastChange("wikiTagAssignment", "update", entityId);
    return c.json({ ok: true });
  });

  return app;
}
