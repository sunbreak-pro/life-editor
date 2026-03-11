import { useState, useCallback } from "react";
import type { TimeMemo } from "../types/timeMemo";
import { getDataService } from "../services";

export function useTimeMemos() {
  const [timeMemos, setTimeMemos] = useState<TimeMemo[]>([]);

  const loadMemosForDate = useCallback(async (date: string) => {
    const memos = await getDataService().fetchTimeMemosByDate(date);
    setTimeMemos(memos);
  }, []);

  const upsertMemo = useCallback(
    async (date: string, hour: number, content: string) => {
      const id = `tmemo-${date}-${hour}`;
      const memo = await getDataService().upsertTimeMemo(
        id,
        date,
        hour,
        content,
      );
      setTimeMemos((prev) => {
        const idx = prev.findIndex((m) => m.hour === hour);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = memo;
          return next;
        }
        return [...prev, memo].sort((a, b) => a.hour - b.hour);
      });
      return memo;
    },
    [],
  );

  const deleteMemo = useCallback(async (id: string) => {
    await getDataService().deleteTimeMemo(id);
    setTimeMemos((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return { timeMemos, loadMemosForDate, upsertMemo, deleteMemo };
}
