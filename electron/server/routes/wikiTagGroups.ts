import { Hono } from "hono";
import type Database from "better-sqlite3";
import { createWikiTagGroupRepository } from "../../database/wikiTagGroupRepository";
import { broadcastChange } from "../broadcast";

export function createWikiTagGroupRoutes(db: Database.Database): Hono {
  const app = new Hono();
  const repo = createWikiTagGroupRepository(db);

  app.get("/", (c) => {
    return c.json(repo.fetchAll());
  });

  app.post("/", async (c) => {
    const body = await c.req.json();
    const { name, noteIds, filterTags } = body;
    if (typeof name !== "string" || !Array.isArray(noteIds)) {
      return c.json(
        { error: "name (string) and noteIds (array) are required" },
        400,
      );
    }
    const result = repo.create(name, noteIds, filterTags);
    broadcastChange("wikiTagGroup", "create", result.id);
    return c.json(result);
  });

  app.patch("/:id", async (c) => {
    const id = c.req.param("id");
    const updates = await c.req.json();
    const result = repo.update(id, updates);
    broadcastChange("wikiTagGroup", "update", id);
    return c.json(result);
  });

  app.delete("/:id", (c) => {
    const id = c.req.param("id");
    repo.delete(id);
    broadcastChange("wikiTagGroup", "delete", id);
    return c.json({ ok: true });
  });

  app.get("/members", (c) => {
    return c.json(repo.fetchAllMembers());
  });

  app.put("/:groupId/members", async (c) => {
    const groupId = c.req.param("groupId");
    const { noteIds } = await c.req.json<{ noteIds: string[] }>();
    repo.setMembers(groupId, noteIds);
    broadcastChange("wikiTagGroup", "update", groupId);
    return c.json({ ok: true });
  });

  app.post("/:groupId/members", async (c) => {
    const groupId = c.req.param("groupId");
    const { noteId } = await c.req.json<{ noteId: string }>();
    repo.addMember(groupId, noteId);
    broadcastChange("wikiTagGroup", "update", groupId);
    return c.json({ ok: true });
  });

  app.delete("/:groupId/members/:noteId", (c) => {
    const groupId = c.req.param("groupId");
    const noteId = c.req.param("noteId");
    repo.removeMember(groupId, noteId);
    broadcastChange("wikiTagGroup", "update", groupId);
    return c.json({ ok: true });
  });

  return app;
}
