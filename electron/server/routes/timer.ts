import { Hono } from "hono";
import type Database from "better-sqlite3";
import { createTimerRepository } from "../../database/timerRepository";
import { createPomodoroPresetRepository } from "../../database/pomodoroPresetRepository";
import { broadcastChange } from "../broadcast";

export function createTimerRoutes(db: Database.Database): Hono {
  const app = new Hono();
  const timerRepo = createTimerRepository(db);
  const presetRepo = createPomodoroPresetRepository(db);

  // Timer Settings
  app.get("/settings", (c) => {
    return c.json(timerRepo.fetchSettings());
  });

  app.patch("/settings", async (c) => {
    const updates = await c.req.json();
    const result = timerRepo.updateSettings(updates);
    broadcastChange("timerSettings", "update");
    return c.json(result);
  });

  // Timer Sessions
  app.post("/sessions/start", async (c) => {
    const body = await c.req.json();
    const { sessionType, taskId } = body;
    if (
      typeof sessionType !== "string" ||
      !["WORK", "BREAK", "LONG_BREAK"].includes(sessionType)
    ) {
      return c.json(
        { error: "sessionType must be WORK, BREAK, or LONG_BREAK" },
        400,
      );
    }
    const session = timerRepo.startSession(
      sessionType as "WORK" | "BREAK" | "LONG_BREAK",
      taskId ?? null,
    );
    broadcastChange("timerSession", "create", session.id);
    return c.json(session);
  });

  app.post("/sessions/:id/end", async (c) => {
    const id = Number(c.req.param("id"));
    if (Number.isNaN(id)) {
      return c.json({ error: "Invalid session ID" }, 400);
    }
    const { duration, completed } = await c.req.json<{
      duration: number;
      completed: boolean;
    }>();
    const session = timerRepo.endSession(id, duration, completed);
    broadcastChange("timerSession", "update", id);
    return c.json(session);
  });

  app.get("/sessions", (c) => {
    return c.json(timerRepo.fetchSessions());
  });

  app.get("/sessions/by-task/:taskId", (c) => {
    const taskId = c.req.param("taskId");
    return c.json(timerRepo.fetchSessionsByTaskId(taskId));
  });

  // Pomodoro Presets
  app.get("/presets", (c) => {
    return c.json(presetRepo.fetchAll());
  });

  app.post("/presets", async (c) => {
    const preset = await c.req.json();
    const result = presetRepo.create(preset);
    broadcastChange("pomodoroPreset", "create", result.id);
    return c.json(result);
  });

  app.patch("/presets/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (Number.isNaN(id)) {
      return c.json({ error: "Invalid preset ID" }, 400);
    }
    const updates = await c.req.json();
    const result = presetRepo.update(id, updates);
    broadcastChange("pomodoroPreset", "update", id);
    return c.json(result);
  });

  app.delete("/presets/:id", (c) => {
    const id = Number(c.req.param("id"));
    if (Number.isNaN(id)) {
      return c.json({ error: "Invalid preset ID" }, 400);
    }
    presetRepo.delete(id);
    broadcastChange("pomodoroPreset", "delete", id);
    return c.json({ ok: true });
  });

  return app;
}
