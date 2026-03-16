import { Hono } from "hono";
import type Database from "better-sqlite3";
import { createTaskRepository } from "../../database/taskRepository";
import type { TaskNode } from "../../types";

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
    return c.json(repo.create(node), 201);
  });

  app.patch("/:id", async (c) => {
    const id = c.req.param("id");
    const updates = await c.req.json<Partial<TaskNode>>();
    return c.json(repo.update(id, updates));
  });

  app.put("/sync", async (c) => {
    const nodes = await c.req.json<TaskNode[]>();
    repo.syncTree(nodes);
    return c.json({ ok: true });
  });

  app.delete("/:id", (c) => {
    const id = c.req.param("id");
    repo.softDelete(id);
    return c.json({ ok: true });
  });

  app.post("/:id/restore", (c) => {
    const id = c.req.param("id");
    repo.restore(id);
    return c.json({ ok: true });
  });

  app.delete("/:id/permanent", (c) => {
    const id = c.req.param("id");
    repo.permanentDelete(id);
    return c.json({ ok: true });
  });

  return app;
}
