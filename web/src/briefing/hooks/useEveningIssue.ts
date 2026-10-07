import { useEffect, useMemo, useState } from "react";
import {
  eveningIssue,
  logServiceError,
  type DailyNode,
  type DataService,
  type EveningIssue,
} from "@life-editor/shared";

/*
 * 「夕刊 第 N 号 · n 日連続」(#2107) — the masthead's issue line.
 *
 * Past days come from listDailiesUnified, read ONCE per (service, day) the
 * first time the evening paper shows, and deliberately NOT on `dailies` sync
 * bumps. The list carries every day's full body, and this tab's own writes
 * echo back through Realtime: following the domain re-listed the whole
 * history on every 800ms reflection save, star tap and note save — and each
 * bump cancelled the read in flight, so while the user kept typing a long
 * history never landed and the line never showed (#2107 review). Past days
 * barely change from elsewhere; a new day, a new service, or remounting the
 * screen (leaving Briefing and coming back) reads again. TODAY is taken from
 * the paper's own `dailyContent`, so tapping a star moves the number at once.
 *
 * Null before the read lands or when it failed — the host then prints no
 * line rather than a wrong number.
 */
export function useEveningIssue(
  ds: DataService,
  todayKey: string,
  dailyContent: string | null,
  active: boolean,
): EveningIssue | null {
  const [loaded, setLoaded] = useState<{
    ds: DataService;
    todayKey: string;
    past: DailyNode[];
  } | null>(null);
  const sameDay =
    loaded !== null && loaded.ds === ds && loaded.todayKey === todayKey;

  useEffect(() => {
    if (!active || sameDay) return;
    let cancelled = false;
    void (async () => {
      try {
        const all = await ds.listDailiesUnified();
        if (cancelled) return;
        setLoaded({
          ds,
          todayKey,
          past: all.filter((d) => d.date < todayKey),
        });
      } catch (err) {
        logServiceError("Briefing", "list dailies for the evening issue", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ds, todayKey, active, sameDay]);

  return useMemo(() => {
    if (loaded === null || !sameDay) return null;
    return eveningIssue(
      [...loaded.past, { date: todayKey, content: dailyContent ?? "" }],
      todayKey,
    );
  }, [loaded, sameDay, todayKey, dailyContent]);
}
