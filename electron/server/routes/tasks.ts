import { Hono } from "hono";
import type Database from "better-sqlite3";
import { createTaskRepository } from "../../database/taskRepository";
import type { TaskNode } from "../../types";
import { broadcastChange } from "../broadcast";

export function createTaskRoutes(db: Database.Database): Hono {
  const app = new Hono();
  const repo = createTaskRepository(db);

  app.get("/", (c) => {
    return c.json(repo.fetchTree());
  });

  app.get("/deleted", (c) => {
    return c.json(repo.fetchDeleted());
  });

  app.post("/", async (c) => {
    const node = await c.req.json<TaskNode>();
    const result = repo.create(node);
    broadcastChange("task", "create", result.id);
    return c.json(result, 201);
  });

  app.patch("/:id", async (c) => {
    const id = c.req.param("id");
    const updates = await c.req.json<Partial<TaskNode>>();
    const result = repo.update(id, updates);
    broadcastChange("task", "update", id);
    return c.json(result);
  });

  app.put("/sync", async (c) => {
    const nodes = await c.req.json<TaskNode[]>();
    repo.syncTree(nodes);
    broadcastChange("task", "bulk");
    return c.json({ ok: true });
  });

  app.delete("/:id", (c) => {
    const id = c.req.param("id");
    repo.softDelete(id);
    broadcastChange("task", "delete", id);
    return c.json({ ok: true });
  });

  app.post("/:id/restore", (c) => {
    const id = c.req.param("id");
    repo.restore(id);
    broadcastChange("task", "update", id);
    return c.json({ ok: true });
  });

  app.delete("/:id/permanent", (c) => {
    const id = c.req.param("id");
    repo.permanentDelete(id);
    broadcastChange("task", "delete", id);
    return c.json({ ok: true });
  });

  return app;
}
