import type Database from "better-sqlite3";
import { Notification, BrowserWindow } from "electron";
import log from "../logger";

interface TaskRow {
  id: string;
  title: string;
  scheduled_at: string;
}

const CHECK_INTERVAL_MS = 60_000; // 60 seconds

export class ReminderService {
  private db: Database.Database | null = null;
  private win: BrowserWindow | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private firedReminders: Set<string> = new Set();
  private firedDailyReviewDate: string | null = null;

  start(db: Database.Database, win: BrowserWindow): void {
    this.db = db;
    this.win = win;

    // Run an initial check, then set up the interval
    this.check();
    this.intervalId = setInterval(() => this.check(), CHECK_INTERVAL_MS);
    log.info("[ReminderService] Started");
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.db = null;
    this.win = null;
    log.info("[ReminderService] Stopped");
  }

  private check(): void {
    if (!this.db || !this.win) return;

    try {
      this.checkTaskReminders();
      this.checkDailyReview();
    } catch (e) {
      log.error("[ReminderService] Error during check:", e);
    }
  }

  private checkTaskReminders(): void {
    const db = this.db!;
    const win = this.win!;

    // Read settings
    const enabledRow = db
      .prepare(`SELECT value FROM app_settings WHERE key = ?`)
      .get("reminder_enabled") as { value: string } | undefined;
    if (enabledRow?.value !== "true") return;

    const offsetRow = db
      .prepare(`SELECT value FROM app_settings WHERE key = ?`)
      .get("reminder_default_offset") as { value: string } | undefined;
    const offsetMinutes = Number(offsetRow?.value ?? "30");

    // Find tasks that are due within the offset window
    const rows = db
      .prepare(
        `SELECT id, title, scheduled_at FROM tasks
         WHERE scheduled_at IS NOT NULL
           AND scheduled_at <= datetime('now', '+' || ? || ' minutes')
           AND scheduled_at > datetime('now')
           AND status != 'DONE'
           AND is_deleted = 0`,
      )
      .all(offsetMinutes) as TaskRow[];

    for (const row of rows) {
      if (this.firedReminders.has(row.id)) continue;

      this.firedReminders.add(row.id);

      // Show native notification
      if (Notification.isSupported()) {
        const notification = new Notification({
          title: "Task Reminder",
          body: row.title,
        });
        notification.show();
      }

      // Notify renderer
      win.webContents.send("reminder:notify", {
        id: row.id,
        title: row.title,
        type: "taskDue",
      });

      log.info(`[ReminderService] Fired reminder for task: ${row.id}`);
    }
  }

  private checkDailyReview(): void {
    const db = this.db!;
    const win = this.win!;

    const enabledRow = db
      .prepare(`SELECT value FROM app_settings WHERE key = ?`)
      .get("daily_review_enabled") as { value: string } | undefined;
    if (enabledRow?.value !== "true") return;

    const timeRow = db
      .prepare(`SELECT value FROM app_settings WHERE key = ?`)
      .get("daily_review_time") as { value: string } | undefined;
    const reviewTime = timeRow?.value ?? "21:00";

    const now = new Date();
    const currentHour = String(now.getHours()).padStart(2, "0");
    const currentMinute = String(now.getMinutes()).padStart(2, "0");
    const currentTime = `${currentHour}:${currentMinute}`;
    const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

    if (currentTime !== reviewTime) return;
    if (this.firedDailyReviewDate === todayStr) return;

    this.firedDailyReviewDate = todayStr;

    if (Notification.isSupported()) {
      const notification = new Notification({
        title: "Daily Review",
        body: "Time to review your day!",
      });
      notification.show();
    }

    win.webContents.send("reminder:notify", {
      id: `daily-review-${todayStr}`,
      title: "Daily Review",
      type: "dailyReview",
    });

    log.info(`[ReminderService] Fired daily review notification`);
  }
}
