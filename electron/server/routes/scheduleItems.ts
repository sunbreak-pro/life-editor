import { Hono } from "hono";
import type Database from "better-sqlite3";
import { createScheduleItemRepository } from "../../database/scheduleItemRepository";
import type { ScheduleItem } from "../../types";

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
    return c.json(
      repo.create(id, date, title, startTime, endTime, routineId, templateId),
      201,
    );
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
    return c.json(repo.update(id, updates));
  });

  app.delete("/:id", (c) => {
    const id = c.req.param("id");
    repo.delete(id);
    return c.json({ ok: true });
  });

  app.post("/:id/toggle-complete", (c) => {
    const id = c.req.param("id");
    return c.json(repo.toggleComplete(id));
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
    return c.json(repo.bulkCreate(items), 201);
  });

  return app;
}
