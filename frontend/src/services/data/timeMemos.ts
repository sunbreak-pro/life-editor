import type { TimeMemo } from "../../types/timeMemo";
import { tauriInvoke } from "../bridge";

export const timeMemosApi = {
  fetchTimeMemosByDate(date: string): Promise<TimeMemo[]> {
    return tauriInvoke("db_time_memos_fetch_by_date", { date });
  },
  upsertTimeMemo(
    id: string,
    date: string,
    hour: number,
    content: string,
  ): Promise<TimeMemo> {
    return tauriInvoke("db_time_memos_upsert", { id, date, hour, content });
  },
  deleteTimeMemo(id: string): Promise<void> {
    return tauriInvoke("db_time_memos_delete", { id });
  },
};
