import { Hono } from "hono";
import type Database from "better-sqlite3";
import { createRoutineTagRepository } from "../../database/routineTagRepository";
import { broadcastChange } from "../broadcast";

export function createRoutineTagRoutes(db: Database.Database): Hono {
  const app = new Hono();
  const repo = createRoutineTagRepository(db);

  app.get("/", (c) => {
    return c.json(repo.fetchAll());
  });

  app.post("/", async (c) => {
    const { name, color } = await c.req.json<{
      name: string;
      color: string;
    }>();
    const result = repo.create(name, color);
    broadcastChange("routineTag", "create", result.id);
    return c.json(result);
  });

  app.patch("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const updates = await c.req.json();
    const result = repo.update(id, updates);
    broadcastChange("routineTag", "update", id);
    return c.json(result);
  });

  app.delete("/:id", (c) => {
    const id = Number(c.req.param("id"));
    repo.delete(id);
    broadcastChange("routineTag", "delete", id);
    return c.json({ ok: true });
  });

  app.get("/assignments", (c) => {
    return c.json(repo.fetchAllAssignments());
  });

  app.put("/routines/:routineId", async (c) => {
    const routineId = c.req.param("routineId");
    const { tagIds } = await c.req.json<{ tagIds: number[] }>();
    repo.setTagsForRoutine(routineId, tagIds);
    broadcastChange("routineTag", "update", routineId);
    return c.json({ ok: true });
  });

  return app;
}
