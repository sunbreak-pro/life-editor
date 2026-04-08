import type Database from "better-sqlite3";
import log from "../logger";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export class AutoArchiveService {
  private db: Database.Database | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  start(db: Database.Database): void {
    this.db = db;

    // Run immediately on start, then every 6 hours
    this.run();
    this.intervalId = setInterval(() => this.run(), SIX_HOURS_MS);
    log.info("[AutoArchiveService] Started");
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.db = null;
    log.info("[AutoArchiveService] Stopped");
  }

  private run(): void {
    if (!this.db) return;

    try {
      const row = this.db
        .prepare(`SELECT value FROM app_settings WHERE key = ?`)
        .get("auto_archive_days") as { value: string } | undefined;

      const days = Number(row?.value ?? "0");
      if (days <= 0) {
        log.info(
          "[AutoArchiveService] auto_archive_days not set or 0, skipping",
        );
        return;
      }

      const result = this.db
        .prepare(
          `UPDATE tasks
           SET is_deleted = 1, deleted_at = datetime('now')
           WHERE status = 'DONE'
             AND completed_at IS NOT NULL
             AND completed_at < datetime('now', '-' || ? || ' days')
             AND is_deleted = 0`,
        )
        .run(days);

      log.info(
        `[AutoArchiveService] Archived ${result.changes} completed task(s) older than ${days} day(s)`,
      );
    } catch (e) {
      log.error("[AutoArchiveService] Error during auto-archive:", e);
    }
  }
}
