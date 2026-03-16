import { Hono } from "hono";
import type Database from "better-sqlite3";
import { createScheduleItemRepository } from "../../database/scheduleItemRepository";
import type { ScheduleItem } from "../../types";
import { broadcastChange } from "../broadcast";

export function createScheduleItemRoutes(db: Database.Database): Hono {
  const app = new Hono();
  const repo = createScheduleItemRepository(db);

  app.get("/by-date/:date", (c) => {
    const date = c.req.param("date");
    return c.json(repo.fetchByDate(date));
  });

  app.get("/by-date-range", (c) => {
    const startDate = c.req.query("start") || "";
    const endDate = c.req.query("end") || "";
    return c.json(repo.fetchByDateRange(startDate, endDate));
  });

  app.post("/", async (c) => {
    const { id, date, title, startTime, endTime, routineId, templateId } =
      await c.req.json<{
        id: string;
        date: string;
        title: string;
        startTime: string;
        endTime: string;
        routineId?: string;
        templateId?: string;
      }>();
    const result = repo.create(
      id,
      date,
      title,
      startTime,
      endTime,
      routineId,
      templateId,
    );
    broadcastChange("scheduleItem", "create", id);
    return c.json(result, 201);
  });

  app.patch("/:id", async (c) => {
    const id = c.req.param("id");
    const updates =
      await c.req.json<
        Partial<
          Pick<
            ScheduleItem,
            | "title"
            | "startTime"
            | "endTime"
            | "completed"
            | "completedAt"
            | "memo"
          >
        >
      >();
    const result = repo.update(id, updates);
    broadcastChange("scheduleItem", "update", id);
    return c.json(result);
  });

  app.delete("/:id", (c) => {
    const id = c.req.param("id");
    repo.delete(id);
    broadcastChange("scheduleItem", "delete", id);
    return c.json({ ok: true });
  });

  app.post("/:id/toggle-complete", (c) => {
    const id = c.req.param("id");
    const result = repo.toggleComplete(id);
    broadcastChange("scheduleItem", "update", id);
    return c.json(result);
  });

  app.post("/bulk", async (c) => {
    const items = await c.req.json<
      Array<{
        id: string;
        date: string;
        title: string;
        startTime: string;
        endTime: string;
        routineId?: string;
        templateId?: string;
      }>
    >();
    const result = repo.bulkCreate(items);
    broadcastChange("scheduleItem", "bulk");
    return c.json(result, 201);
  });

  return app;
}
