import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "calendarTagFilter";

/** Selection: tagId number | "untagged" (no tag) | null (no filter / show all) */
export type CalendarTagFilter = number | "untagged" | null;

function readStored(): CalendarTagFilter {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw == null) return null;
    if (raw === "untagged") return "untagged";
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStored(value: CalendarTagFilter): void {
  if (typeof window === "undefined") return;
  try {
    if (value === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    /* ignore */
  }
}

export function useCalendarTagFilter() {
  const [activeFilterTagId, setActiveFilterTagIdState] =
    useState<CalendarTagFilter>(() => readStored());

  useEffect(() => {
    writeStored(activeFilterTagId);
  }, [activeFilterTagId]);

  const setActiveFilterTagId = useCallback((value: CalendarTagFilter) => {
    setActiveFilterTagIdState(value);
  }, []);

  return useMemo(
    () => ({ activeFilterTagId, setActiveFilterTagId }),
    [activeFilterTagId, setActiveFilterTagId],
  );
}
