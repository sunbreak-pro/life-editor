import { useEffect, useState } from "react";
import {
  eventWorkBreakdown,
  getDataService,
  logServiceError,
  useSyncDomains,
  useUndoRedoOptional,
  type EventWorkAnchor,
  type TimerSession,
  type WorkTarget,
  type WorkTargetKind,
} from "@life-editor/shared";

/*
 * Logged work time for the selected event (#1375, #2407).
 *
 * The Work timer can be started against a calendar entry since 0029, and the
 * event's own editor is where "how long did this actually take" belongs — the
 * replacement for the completion pill #1373 removed. The number is derived from
 * `timer_sessions` every time, so there is no second copy of it on the event to
 * drift. Since #2407 the editor can also add to it: a typed total becomes one
 * hand-entered row in that same log (`saveEventWorkTotal`).
 *
 * Its own read rather than a prop drilled from CalendarTab: the calendar does
 * not fetch sessions for any other reason, and pulling the whole log on every
 * grid render to serve one panel would cost far more than the one filtered
 * request this makes when a panel opens. Hosts may call `getDataService()`
 * (§6.4); the pane underneath stays pure and receives finished values.
 *
 * #2553: a todo's detail panel edits the same total, against `task_id`
 * instead of `event_id`. `useItemWorkTime` takes either; `useEventWorkTime`
 * stays as the event editor's name for it.
 *
 * `getDataService()` THROWS synchronously when the app has no Supabase config,
 * so each call sits inside a try — the same shape SettingsScreen uses.
 */

/**
 * What the read knows. `loading` and `failed` are not zero: the editable total
 * is only safe once the timer's share is known, because the hand-entered row is
 * the difference between the two.
 */
export type EventWorkTimeRead =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; totalMinutes: number; timerMinutes: number };

const LOADING: EventWorkTimeRead = { status: "loading" };

export interface EventWorkTimeHandle {
  read: EventWorkTimeRead;
  /**
   * Write a total (null = drop the hand-entered part). `previousAnchor` is where
   * the row goes back to on undo.
   */
  save: (
    totalMinutes: number | null,
    anchor: EventWorkAnchor,
    previousAnchor: EventWorkAnchor,
  ) => void;
}

/** The log's read and write for one kind of item (#2553). */
const WORK_LOG: Record<
  WorkTargetKind,
  {
    fetch: string;
    save: string;
    read: (id: string) => Promise<TimerSession[]>;
    write: (input: {
      id: string;
      anchor: EventWorkAnchor;
      totalMinutes: number | null;
    }) => Promise<void>;
  }
> = {
  event: {
    fetch: "fetchSessionsByEventId",
    save: "saveEventWorkTotal",
    read: (id) => getDataService().fetchSessionsByEventId(id),
    write: ({ id, anchor, totalMinutes }) =>
      getDataService().saveEventWorkTotal({
        eventId: id,
        anchor,
        totalMinutes,
      }),
  },
  todo: {
    fetch: "fetchSessionsByTodoId",
    save: "saveTodoWorkTotal",
    read: (id) => getDataService().fetchSessionsByTodoId(id),
    write: ({ id, anchor, totalMinutes }) =>
      getDataService().saveTodoWorkTotal({ todoId: id, anchor, totalMinutes }),
  },
};

export function useEventWorkTime(
  eventId: string | null,
  onSaveFailed?: () => void,
): EventWorkTimeHandle {
  return useItemWorkTime(
    eventId === null ? null : { kind: "event", id: eventId },
    onSaveFailed,
  );
}

export function useItemWorkTime(
  target: WorkTarget | null,
  onSaveFailed?: () => void,
): EventWorkTimeHandle {
  // Primitives for the effect: the caller builds the target object inline.
  const kind = target?.kind ?? "event";
  const eventId = target?.id ?? null;
  const log = WORK_LOG[kind];
  /*
   * The result carries the id it belongs to, and "which event is this for" is
   * DERIVED from comparing that id against the current one — the same trick
   * `useDomainLoad` uses, and for the same reason. Clearing on a switch by
   * writing `setRead(LOADING)` in the effect body would be a state write during
   * an effect (an extra render pass, and the `set-state-in-effect` rule turned
   * off for this file) that changes the timing by nothing at all. Without the
   * guard in SOME form, switching from an event with logged time to one with
   * none would keep showing the previous event's number — the worst possible
   * moment to be wrong about it.
   */
  const [loaded, setLoaded] = useState<{
    id: string;
    read: EventWorkTimeRead;
  } | null>(null);
  // The log is its own Sync domain (#993), so this follows `sessions` alone —
  // an event edit does not change the time already logged against it.
  const syncVersion = useSyncDomains("sessions");
  // A write re-reads once it lands, so the panel does not depend on the
  // Realtime echo to settle.
  const [writeTick, setWriteTick] = useState(0);
  const pushUndo = useUndoRedoOptional()?.push;

  useEffect(() => {
    if (eventId === null) return;
    let cancelled = false;
    void (async () => {
      try {
        const sessions = await WORK_LOG[kind].read(eventId);
        if (!cancelled) {
          const { totalMinutes, timerMinutes } = eventWorkBreakdown(
            sessions,
            eventId,
          );
          setLoaded({
            id: eventId,
            read: { status: "ready", totalMinutes, timerMinutes },
          });
        }
      } catch (e) {
        if (!cancelled) setLoaded({ id: eventId, read: { status: "failed" } });
        logServiceError("Schedule", WORK_LOG[kind].fetch, e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kind, eventId, syncVersion, writeTick]);

  const read = loaded !== null && loaded.id === eventId ? loaded.read : LOADING;

  const save: EventWorkTimeHandle["save"] = (
    totalMinutes,
    anchor,
    previousAnchor,
  ) => {
    if (eventId === null || read.status !== "ready") return;
    const write = async (
      total: number | null,
      where: EventWorkAnchor,
    ): Promise<void> => {
      /*
       * Painted first, so the field and the Save button settle in the same
       * press the way every other field on the pane does. The re-read below
       * replaces it either way, which is also what puts the old number back
       * when the write fails.
       */
      setLoaded((cur) =>
        cur !== null && cur.id === eventId && cur.read.status === "ready"
          ? {
              id: eventId,
              read: {
                ...cur.read,
                totalMinutes: total ?? cur.read.timerMinutes,
              },
            }
          : cur,
      );
      try {
        await log.write({ id: eventId, anchor: where, totalMinutes: total });
      } catch (e) {
        logServiceError("Schedule", log.save, e);
        onSaveFailed?.();
      } finally {
        setWriteTick((n) => n + 1);
      }
    };
    // Null, not the number, when nothing was hand-entered: undo must take the
    // row away rather than leave one holding a timer's rounding remainder.
    const previousTotal =
      read.totalMinutes > read.timerMinutes ? read.totalMinutes : null;
    void write(totalMinutes, anchor);
    /*
     * Its own entry beside the provider's "updateScheduleItem", because the
     * two writes go to different tables: the field patch reaches the provider
     * through the host's scope question, which this cannot join. A press that
     * changes both takes two undos.
     *
     * No `confirm`: the row belongs to this one occurrence, so reversing it
     * does not touch the series.
     */
    pushUndo?.("scheduleItem", {
      label: "saveEventWorkTotal",
      undo: () => write(previousTotal, previousAnchor),
      redo: () => write(totalMinutes, anchor),
    });
  };

  return { read, save };
}
