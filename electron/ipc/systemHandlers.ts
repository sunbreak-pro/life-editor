import { query, mutation } from "./handlerUtil";
import { app } from "electron";
import type { AppSettingsRepository } from "../database/appSettingsRepository";

export function registerSystemHandlers(repo: AppSettingsRepository): void {
  // --- Auto Launch ---
  query("system:getAutoLaunch", "System", "getAutoLaunch", () => {
    return app.getLoginItemSettings().openAtLogin;
  });

  mutation(
    "system:setAutoLaunch",
    "System",
    "setAutoLaunch",
    "system",
    "update",
    (_event, enabled: boolean) => {
      app.setLoginItemSettings({ openAtLogin: enabled });
      repo.set("auto_launch", String(enabled));
    },
    () => undefined,
  );

  // --- Start Minimized ---
  query("system:getStartMinimized", "System", "getStartMinimized", () => {
    const value = repo.get("start_minimized");
    return value === "true";
  });

  mutation(
    "system:setStartMinimized",
    "System",
    "setStartMinimized",
    "system",
    "update",
    (_event, enabled: boolean) => {
      repo.set("start_minimized", String(enabled));
    },
    () => undefined,
  );

  // --- Tray Enabled ---
  query("system:getTrayEnabled", "System", "getTrayEnabled", () => {
    const value = repo.get("tray_enabled");
    return value === "true";
  });

  mutation(
    "system:setTrayEnabled",
    "System",
    "setTrayEnabled",
    "system",
    "update",
    (_event, enabled: boolean) => {
      repo.set("tray_enabled", String(enabled));
    },
    () => undefined,
  );

  // --- Global Shortcuts ---
  query("system:getGlobalShortcuts", "System", "getGlobalShortcuts", () => {
    const raw = repo.get("global_shortcuts");
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Record<string, string>;
    } catch {
      return null;
    }
  });

  mutation(
    "system:setGlobalShortcuts",
    "System",
    "setGlobalShortcuts",
    "system",
    "update",
    (_event, shortcuts: Record<string, string>) => {
      repo.set("global_shortcuts", JSON.stringify(shortcuts));
    },
    () => undefined,
  );

  // --- Tray Timer Update (no-op: actual tray update is handled by tray module) ---
  query("tray:updateTimer", "System", "updateTimer", () => {
    // no-op — the tray module listens for timer state changes directly
  });

  // --- Reminder Settings ---
  query("reminder:getSettings", "System", "getReminderSettings", () => {
    return {
      enabled: repo.get("reminder_enabled") === "true",
      defaultOffset: Number(repo.get("reminder_default_offset") ?? "30"),
      dailyReviewEnabled: repo.get("daily_review_enabled") === "true",
      dailyReviewTime: repo.get("daily_review_time") ?? "21:00",
    };
  });

  mutation(
    "reminder:setSettings",
    "System",
    "setReminderSettings",
    "system",
    "update",
    (
      _event,
      settings: {
        enabled?: boolean;
        defaultOffset?: number;
        dailyReviewEnabled?: boolean;
        dailyReviewTime?: string;
      },
    ) => {
      if (settings.enabled !== undefined) {
        repo.set("reminder_enabled", String(settings.enabled));
      }
      if (settings.defaultOffset !== undefined) {
        repo.set("reminder_default_offset", String(settings.defaultOffset));
      }
      if (settings.dailyReviewEnabled !== undefined) {
        repo.set("daily_review_enabled", String(settings.dailyReviewEnabled));
      }
      if (settings.dailyReviewTime !== undefined) {
        repo.set("daily_review_time", settings.dailyReviewTime);
      }
    },
    () => undefined,
  );
}
