import { Hono } from "hono";
import type Database from "better-sqlite3";
import { createRoutineRepository } from "../../database/routineRepository";
import type { RoutineNode } from "../../types";

export function createRoutineRoutes(db: Database.Database): Hono {
  const app = new Hono();
  const repo = createRoutineRepository(db);

  app.get("/", (c) => {
    return c.json(repo.fetchAll());
  });

  app.get("/deleted", (c) => {
    return c.json(repo.fetchDeleted());
  });

  app.post("/", async (c) => {
    const { id, title, startTime, endTime } = await c.req.json<{
      id: string;
      title: string;
      startTime?: string;
      endTime?: string;
    }>();
    return c.json(repo.create(id, title, startTime, endTime), 201);
  });

  app.patch("/:id", async (c) => {
    const id = c.req.param("id");
    const updates =
      await c.req.json<
        Partial<
          Pick<
            RoutineNode,
            "title" | "startTime" | "endTime" | "isArchived" | "order"
          >
        >
      >();
    return c.json(repo.update(id, updates));
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
