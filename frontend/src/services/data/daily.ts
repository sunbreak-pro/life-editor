import type { DailyNode } from "../../types/daily";
import { tauriInvoke } from "../bridge";

export const dailyApi = {
  fetchAllDailies(): Promise<DailyNode[]> {
    return tauriInvoke("db_daily_fetch_all");
  },
  fetchDailyByDate(date: string): Promise<DailyNode | null> {
    return tauriInvoke("db_daily_fetch_by_date", { date });
  },
  upsertDaily(date: string, content: string): Promise<DailyNode> {
    return tauriInvoke("db_daily_upsert", { date, content });
  },
  deleteDaily(date: string): Promise<void> {
    return tauriInvoke("db_daily_delete", { date });
  },
  fetchDeletedDailies(): Promise<DailyNode[]> {
    return tauriInvoke("db_daily_fetch_deleted");
  },
  restoreDaily(date: string): Promise<void> {
    return tauriInvoke("db_daily_restore", { date });
  },
  permanentDeleteDaily(date: string): Promise<void> {
    return tauriInvoke("db_daily_permanent_delete", { date });
  },
  toggleDailyPin(date: string): Promise<DailyNode> {
    return tauriInvoke("db_daily_toggle_pin", { date });
  },
  setDailyPassword(date: string, password: string): Promise<DailyNode> {
    return tauriInvoke("db_daily_set_password", { date, password });
  },
  removeDailyPassword(
    date: string,
    currentPassword: string,
  ): Promise<DailyNode> {
    return tauriInvoke("db_daily_remove_password", {
      date,
      currentPassword,
    });
  },
  verifyDailyPassword(date: string, password: string): Promise<boolean> {
    return tauriInvoke("db_daily_verify_password", { date, password });
  },
  toggleDailyEditLock(date: string): Promise<DailyNode> {
    return tauriInvoke("db_daily_toggle_edit_lock", { date });
  },
};
