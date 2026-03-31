import { Hono } from "hono";
import type Database from "better-sqlite3";
import { createRoutineRepository } from "../../database/routineRepository";
import type { RoutineNode } from "../../types";
import { broadcastChange } from "../broadcast";

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
    const {
      id,
      title,
      startTime,
      endTime,
      frequencyType,
      frequencyDays,
      frequencyInterval,
      frequencyStartDate,
    } = await c.req.json<{
      id: string;
      title: string;
      startTime?: string;
      endTime?: string;
      frequencyType?: "daily" | "weekdays" | "interval";
      frequencyDays?: number[];
      frequencyInterval?: number;
      frequencyStartDate?: string;
    }>();
    const result = repo.create(
      id,
      title,
      startTime,
      endTime,
      frequencyType,
      frequencyDays,
      frequencyInterval,
      frequencyStartDate,
    );
    broadcastChange("routine", "create", id);
    return c.json(result, 201);
  });

  app.patch("/:id", async (c) => {
    const id = c.req.param("id");
    const updates =
      await c.req.json<
        Partial<
          Pick<
            RoutineNode,
            | "title"
            | "startTime"
            | "endTime"
            | "isArchived"
            | "order"
            | "frequencyType"
            | "frequencyDays"
            | "frequencyInterval"
            | "frequencyStartDate"
          >
        >
      >();
    const result = repo.update(id, updates);
    broadcastChange("routine", "update", id);
    return c.json(result);
  });

  app.delete("/:id", (c) => {
    const id = c.req.param("id");
    repo.softDelete(id);
    broadcastChange("routine", "delete", id);
    return c.json({ ok: true });
  });

  app.post("/:id/restore", (c) => {
    const id = c.req.param("id");
    repo.restore(id);
    broadcastChange("routine", "update", id);
    return c.json({ ok: true });
  });

  app.delete("/:id/permanent", (c) => {
    const id = c.req.param("id");
    repo.permanentDelete(id);
    broadcastChange("routine", "delete", id);
    return c.json({ ok: true });
  });

  return app;
}
