import { useCallback, useEffect, useMemo, useState } from "react";
import {
  dateKeyOfInstant,
  extractBriefing,
  formatDateKey,
  generateId,
  localDateTimeToISO,
  pickAddableTasks,
  tasksToCalendarChips,
  useSyncDomains,
  useTranslation,
  useUndoRedoOptional,
  type RepeatScope,
  type BriefingCarryoverEntry,
  type BriefingData,
  type BriefingScheduleEntry,
  type BriefingTaskEntry,
  type DataService,
  type EveningScheduleEntry,
  type EveningTodoEntry,
  type ItemCreateNoteDraft,
  type ItemCreateOption,
  type NoteNode,
  type ScheduleItem,
  type TodoNode,
  type TodoStatus,
  type TimerSession,
  type TodayTodoRow,
  type WikiTagConnectionUnified,
} from "@life-editor/shared";

/*
 * Data half of the Briefing host (extracted from BriefingScreen.tsx —
 * hooks split, zero behavior change). Owns fetching, aggregation and the
 * direct DataService writes that update fetched state.
 *
 * Data sources (all EXISTING APIs — Step 1 ships with zero DDL):
 *   - fetchScheduleItemsByDate(today)     → 今日の予定
 *   - fetchTodoTree()                     → 今日の Todo / 持ち越し / trend widget
 *   - fetchTimerSessions()                → streak + work/break widgets
 *   - getDailyByDateUnified(today)        → the "Briefing"/「朝刊」 section
 *     (extractBriefing convention — written later by MCP write_briefing,
 *     or by hand in the Daily editor today)
 *   - listNotesUnified() + listAllTagConnections()
 *     → task↔note item links resolved to note titles =「その目的」chips
 *       (read-only Goal links; the unified graph already supports them)
 *
 * Re-fetches on every Realtime `syncVersion` bump (same pattern as
 * MaterialsCountsBridge) so a briefing written by Claude via MCP appears
 * without a reload. Sits inside SyncProvider (MainScreen mounts the
 * screen there).
 */

/*
 * LOCAL "YYYY-MM-DD" from a stored scheduledAt (#413 fix). This used to slice
 * the first 10 chars, which reads the UTC day: in JST an all-day task staged
 * at local midnight is stored as `…T15:00:00Z` on the PREVIOUS date, so the
 * paper filed every such task under 持ち越し「2日目」 instead of 今日の Todo
 * — including the ones the new rightSidebar tray adds. The tray itself keys
 * on the LOCAL day (tasksToCalendarChips), and now so does the paper.
 */
const dateKeyOf = dateKeyOfInstant;

/** Whole-day difference between two "YYYY-MM-DD" keys (b - a). */
function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00`) - Date.parse(`${a}T00:00:00`);
  return Math.max(0, Math.round(ms / 86_400_000));
}

/** The "YYYY-MM-DD" key of the day after `key` (local-time arithmetic). */
function nextDateKey(key: string): string {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return formatDateKey(d);
}

export function useBriefingData(ds: DataService, todayKey: string) {
  const { t, i18n } = useTranslation();
  const syncVersion = useSyncDomains(
    "schedule",
    "todos",
    "timer",
    "dailies",
    "notes",
    "tags",
  );

  const [loading, setLoading] = useState(true);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [tomorrowItems, setTomorrowItems] = useState<ScheduleItem[]>([]);
  const [taskNodes, setTaskNodes] = useState<TodoNode[]>([]);
  const [sessions, setSessions] = useState<TimerSession[]>([]);
  const [dailyContent, setDailyContent] = useState<string | null>(null);
  const [notes, setNotes] = useState<NoteNode[]>([]);
  const [connections, setConnections] = useState<WikiTagConnectionUnified[]>(
    [],
  );
  // #585: the routine-derived row waiting on a this/future/all answer. Holds
  // the whole ScheduleItem (not just the id) because the answer is applied
  // after the row has already left `scheduleItems`.
  const [deleteScopeItem, setDeleteScopeItem] = useState<ScheduleItem | null>(
    null,
  );

  // Global undo stack (#304). Optional so the hook still runs in tests and
  // outside UndoRedoProvider; when it IS there, a delete from the paper is
  // reversible exactly like the same delete made in Schedule or Tasks.
  const undoRedo = useUndoRedoOptional();
  const push = undoRedo?.push;

  const tomorrowKey = nextDateKey(todayKey);

  useEffect(() => {
    // loading starts true (useState) so the initial fetch shows the skeleton;
    // re-fetches on syncVersion bumps keep the (still-valid) paper visible
    // until the fresh data resolves (same pattern as WorkScreen's task fetch).
    let cancelled = false;
    void Promise.allSettled([
      ds.fetchScheduleItemsByDate(todayKey),
      ds.fetchTodoTree(),
      ds.fetchTimerSessions(),
      ds.getDailyByDateUnified(todayKey),
      ds.listNotesUnified(),
      ds.listAllTagConnections(),
      ds.fetchScheduleItemsByDate(tomorrowKey),
    ]).then((results) => {
      if (cancelled) return;
      const [sched, tasks, sess, daily, allNotes, links, tomorrow] = results;
      if (sched.status === "fulfilled") setScheduleItems(sched.value);
      if (tasks.status === "fulfilled") setTaskNodes(tasks.value);
      if (sess.status === "fulfilled") setSessions(sess.value);
      if (daily.status === "fulfilled")
        setDailyContent(daily.value?.content ?? null);
      if (allNotes.status === "fulfilled") setNotes(allNotes.value);
      if (links.status === "fulfilled") setConnections(links.value);
      if (tomorrow.status === "fulfilled") setTomorrowItems(tomorrow.value);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [ds, todayKey, tomorrowKey, syncVersion]);

  // ── Aggregation (host-side; the view stays pure) ─────────────────────
  const noteTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of notes) {
      if (n.isDeleted !== true) map.set(n.id, n.title || "");
    }
    return map;
  }, [notes]);

  /** Titles of notes linked to an item (either link direction). */
  const purposesOf = useCallback(
    (itemId: string): string[] => {
      const titles: string[] = [];
      for (const link of connections) {
        const other =
          link.fromItemId === itemId
            ? link.toItemId
            : link.toItemId === itemId
              ? link.fromItemId
              : null;
        if (other === null) continue;
        const title = noteTitleById.get(other);
        if (title !== undefined && title !== "") titles.push(title);
      }
      return titles;
    },
    [connections, noteTitleById],
  );

  const schedule = useMemo<BriefingScheduleEntry[]>(
    () =>
      scheduleItems
        .filter((s) => s.isDeleted !== true && s.isDismissed !== true)
        .sort((a, b) => {
          const aAll = a.isAllDay === true ? 0 : 1;
          const bAll = b.isAllDay === true ? 0 : 1;
          if (aAll !== bAll) return aAll - bAll;
          return a.startTime.localeCompare(b.startTime);
        })
        .map((s) => ({
          id: s.id,
          title: s.title,
          startTime: s.startTime,
          completed: s.completed,
          isRoutine: s.routineId !== null,
          isAllDay: s.isAllDay === true,
        })),
    [scheduleItems],
  );

  const liveTasks = useMemo(
    () => taskNodes.filter((n) => n.type === "task" && n.isDeleted !== true),
    [taskNodes],
  );

  // Not started / In progress / Done by task id (#796). The paper's rows and
  // the tray's chips both flattened status to a boolean; this is what they read
  // it back from, so neither has to carry its own copy of the rule.
  const statusById = useMemo(() => {
    const map = new Map<string, TodoStatus>();
    for (const n of liveTasks) map.set(n.id, n.status ?? "NOT_STARTED");
    return map;
  }, [liveTasks]);

  const todayTasks = useMemo<BriefingTaskEntry[]>(
    () =>
      liveTasks
        .filter((n) => dateKeyOf(n.scheduledAt) === todayKey)
        .map((n) => ({
          id: n.id,
          title: n.title,
          status: n.status ?? "NOT_STARTED",
          purposes: purposesOf(n.id),
        })),
    [liveTasks, todayKey, purposesOf],
  );

  const carryover = useMemo<BriefingCarryoverEntry[]>(
    () =>
      liveTasks
        .filter((n) => {
          const key = dateKeyOf(n.scheduledAt);
          if (key === null || key >= todayKey) return false;
          if (n.status !== "DONE") return true;
          return (
            n.completedAt !== undefined &&
            Date.parse(n.completedAt) >= Date.parse(`${todayKey}T00:00:00`)
          );
        })
        .map((n) => ({
          node: n,
          days: daysBetween(dateKeyOf(n.scheduledAt) ?? todayKey, todayKey),
        }))
        .sort((a, b) => b.days - a.days)
        .slice(0, 5)
        .map(({ node, days }) => ({
          id: node.id,
          title: node.title,
          daysLabel: t("briefing.carryoverDays", { count: days + 1 }),
          completed: node.status === "DONE",
        })),
    [liveTasks, todayKey, t],
  );

  const dateLine = useMemo(() => {
    const locale = i18n.language.startsWith("ja") ? "ja-JP" : "en-US";
    return new Date(`${todayKey}T00:00:00`).toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });
  }, [todayKey, i18n.language]);

  const data = useMemo<BriefingData>(
    () => ({
      dateLine,
      briefing: extractBriefing(dailyContent),
      schedule,
      tasks: todayTasks,
      carryover,
      sessions,
      taskNodes: liveTasks,
    }),
    [
      dateLine,
      dailyContent,
      schedule,
      todayTasks,
      carryover,
      sessions,
      liveTasks,
    ],
  );

  //「残りの Todo」— today's unfinished + open carryover, each carrying its real
  // Not started / In progress / Done status (#796).
  //
  // A row moved to DONE **today** stays on the list (struck through) instead of
  // vanishing under the finger that tapped it: a control you cannot see the
  // result of is not a control, and taking a mis-tap back must not mean going
  // to another screen. Same "completed today still counts" rule the carryover
  // block already used, so a task closed yesterday is still gone.
  const remainingTodos = useMemo<EveningTodoEntry[]>(() => {
    const dayStart = Date.parse(`${todayKey}T00:00:00`);
    return [
      ...liveTasks
        .filter((n) => dateKeyOf(n.scheduledAt) === todayKey)
        .filter(
          (n) =>
            n.status !== "DONE" ||
            (n.completedAt !== undefined &&
              Date.parse(n.completedAt) >= dayStart),
        )
        .map((n) => ({
          id: n.id,
          title: n.title,
          status: n.status ?? "NOT_STARTED",
        })),
      ...carryover.map((item) => ({
        id: item.id,
        title: item.title,
        meta: item.daysLabel,
        status: statusById.get(item.id) ?? "NOT_STARTED",
      })),
    ];
  }, [liveTasks, todayKey, carryover, statusById]);

  //「今後の予定」— the rest of today (from now) + all of tomorrow.
  const upcoming = useMemo<EveningScheduleEntry[]>(() => {
    const now = new Date();
    const nowHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes(),
    ).padStart(2, "0")}`;
    const todayRest = schedule
      .filter((s) => !s.completed && (s.isAllDay || s.startTime >= nowHHMM))
      .map((s) => ({
        id: s.id,
        title: s.title,
        startTime: s.startTime,
        isAllDay: s.isAllDay,
        isTomorrow: false,
      }));
    const tomorrow = tomorrowItems
      .filter((s) => s.isDeleted !== true && s.isDismissed !== true)
      .sort((a, b) => {
        const aAll = a.isAllDay === true ? 0 : 1;
        const bAll = b.isAllDay === true ? 0 : 1;
        if (aAll !== bAll) return aAll - bAll;
        return a.startTime.localeCompare(b.startTime);
      })
      .map((s) => ({
        id: s.id,
        title: s.title,
        startTime: s.startTime,
        isAllDay: s.isAllDay === true,
        isTomorrow: true,
      }));
    return [...todayRest, ...tomorrow];
  }, [schedule, tomorrowItems]);

  const handleToggleScheduleItem = useCallback(
    (id: string) => {
      void ds.toggleScheduleItemComplete(id).then((updated) => {
        setScheduleItems((prev) =>
          prev.map((s) => (s.id === updated.id ? updated : s)),
        );
      });
    },
    [ds],
  );

  /**
   * Write a Todo's status (#796). `completedAt` follows it — DONE stamps the
   * moment, anything else clears it — because that stamp is what decides
   * whether a closed task still belongs on today's paper.
   *
   * The new status is painted BEFORE the write resolves and rolled back if it
   * fails. `updateTodo` is several sequential requests, and a status control
   * that does not move until they all return reads as broken.
   */
  const handleSetTaskStatus = useCallback(
    (id: string, status: TodoStatus) => {
      const target = taskNodes.find((n) => n.id === id);
      if (target === undefined || target.status === status) return;
      const patch = {
        status,
        completedAt: status === "DONE" ? new Date().toISOString() : undefined,
      };

      setTaskNodes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, ...patch } : n)),
      );
      void ds
        .updateTodo(id, patch)
        .then((updated) => {
          setTaskNodes((prev) =>
            prev.map((n) => (n.id === updated.id ? updated : n)),
          );
        })
        // The row renders on the paper and in the rightSidebar tray (#413), so
        // a failed write puts the ORIGINAL node back — an optimistic status
        // that survives its own failure is a lie about what is stored.
        .catch((err) => {
          console.error("[BriefingScreen] task status write failed", err);
          setTaskNodes((prev) => prev.map((n) => (n.id === id ? target : n)));
        });
    },
    [ds, taskNodes],
  );

  /** Binary completion, still what the morning paper's rows speak (#796 gave
   *  the three statuses to the evening rows and the tray only). */
  const handleToggleTask = useCallback(
    (id: string) => {
      const target = taskNodes.find((n) => n.id === id);
      if (target === undefined) return;
      handleSetTaskStatus(
        id,
        target.status === "DONE" ? "NOT_STARTED" : "DONE",
      );
    },
    [taskNodes, handleSetTaskStatus],
  );

  // ── Creating into today (#623) ───────────────────────────────────────
  /*
   * The paper's「+」opens Schedule's shared <ItemCreatePanel>, so the same
   * three creates it offers there have to work here: a new event, a new task,
   * and placing an existing task — each landing on the day the paper is
   * showing. The writes go through `ds` because Briefing mounts none of the
   * Schedule / TaskTree providers (§3.1 — the boundary, not the providers, is
   * what the rule is about), and the results are folded straight into the
   * fetched state so the paper updates without waiting for the Realtime bump.
   *
   * `useSyncDomains("schedule", "todos", …)` at the top of this hook is what
   * makes the OTHER direction work — a row created here shows up in Schedule
   * as soon as Realtime reports it, and vice versa.
   */

  /** The pool the panel's "existing note" picker offers (live, newest first). */
  const noteOptions = useMemo<ItemCreateOption[]>(
    () =>
      notes
        .filter((n) => n.isDeleted !== true)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((n) => ({ id: n.id, title: n.title })),
    [notes],
  );

  /*
   * Attach the note the panel staged to the item just created.
   *
   * CALL ONLY ONCE THE ITEM'S ROW EXISTS — `wiki_tag_connections.from_item_id`
   * is an FK to `items_meta` and the RLS insert policy re-checks it, so the
   * link has to follow the awaited create rather than race it (#371, and the
   * ORDERING note in Schedule's useCreatePanelNotes). Fire and forget: a lost
   * attachment must not roll the event back.
   */
  const attachNote = useCallback(
    (itemId: string, draft: ItemCreateNoteDraft | null) => {
      if (draft === null) return;
      void (async () => {
        try {
          let noteId = draft.kind === "existing" ? draft.id : null;
          if (draft.kind === "new") {
            const now = new Date().toISOString();
            const id = generateId("note");
            await ds.createNoteUnified({
              id,
              type: "note",
              title: draft.title,
              content: "",
              parentId: null,
              order: 0,
              isPinned: false,
              isDeleted: false,
              createdAt: now,
              updatedAt: now,
            });
            noteId = id;
          }
          // Direction is item → note, matching DailyView and Schedule's own
          // attachment: the thing with the date owns the link, and the note
          // sees it as a backlink. The created row is folded into the link
          // state so a task's「その目的」chip appears with it.
          if (noteId !== null) {
            const link = await ds.createItemLink(
              generateId("link"),
              itemId,
              noteId,
            );
            setConnections((prev) => [...prev, link]);
          }
        } catch (err) {
          console.error("[BriefingScreen] attaching the note failed", err);
        }
      })();
    },
    [ds],
  );

  const handleCreateEvent = useCallback(
    (
      title: string,
      start: string,
      end: string,
      note: ItemCreateNoteDraft | null,
    ) => {
      void ds
        .createScheduleItem(
          generateId("event"),
          todayKey,
          title,
          start,
          end,
          undefined,
          undefined,
          undefined,
          false,
        )
        .then((saved) => {
          setScheduleItems((prev) => [...prev, saved]);
          attachNote(saved.id, note);
        })
        .catch((err) => {
          console.error("[BriefingScreen] event create failed", err);
        });
    },
    [ds, todayKey, attachNote],
  );

  const handleCreateTask = useCallback(
    (
      title: string,
      start: string,
      end: string,
      note: ItemCreateNoteDraft | null,
    ) => {
      const now = new Date().toISOString();
      // Root-level (parentId null), like every other quick-create entry: the
      // panel carries no place-in-the-tree control and re-parenting belongs to
      // the Tasks section.
      void ds
        .createTodo({
          id: generateId("task"),
          type: "task",
          title,
          status: "NOT_STARTED",
          parentId: null,
          order: 0,
          scheduledAt: localDateTimeToISO(todayKey, start),
          scheduledEndAt: localDateTimeToISO(todayKey, end),
          isAllDay: false,
          createdAt: now,
          updatedAt: now,
        })
        .then((saved) => {
          setTaskNodes((prev) => [...prev, saved]);
          attachNote(saved.id, note);
        })
        .catch((err) => {
          console.error("[BriefingScreen] task create failed", err);
        });
    },
    [ds, todayKey, attachNote],
  );

  const handlePlaceTask = useCallback(
    (
      taskId: string,
      start: string,
      end: string,
      note: ItemCreateNoteDraft | null,
    ) => {
      // `isAllDay: false` rides along because a task given a concrete window
      // is by definition not an all-day candidate — leaving the flag alone is
      // what kept placed chips rendering in the all-day lane (timedPlacement).
      void ds
        .updateTodo(taskId, {
          scheduledAt: localDateTimeToISO(todayKey, start),
          scheduledEndAt: localDateTimeToISO(todayKey, end),
          isAllDay: false,
        })
        .then((updated) => {
          setTaskNodes((prev) =>
            prev.map((n) => (n.id === updated.id ? updated : n)),
          );
          attachNote(updated.id, note);
        })
        .catch((err) => {
          console.error("[BriefingScreen] task placement failed", err);
        });
    },
    [ds, todayKey, attachNote],
  );

  // ── Row deletes (#585) ───────────────────────────────────────────────
  // The paper writes through `ds` rather than the Schedule / TaskTree
  // providers (MainScreen mounts this screen bare), so the optimistic list
  // update and the undo command are spelled out here instead of coming free
  // from useScheduleItemsAPI / useTodoTreeHistory. The DataService calls
  // themselves are the EXISTING delete paths — same soft delete, same Trash,
  // same restore — so a row deleted from the paper behaves like one deleted
  // from its own section.
  const handleDeleteScheduleItem = useCallback(
    (id: string) => {
      const target = scheduleItems.find((s) => s.id === id);
      if (target === undefined) return;
      // A routine occurrence must not be plain-deleted: the generator would
      // simply put it back (known-issue 017). Ask which occurrences first —
      // Schedule's own dialog, mounted by BriefingScreen.
      if (target.routineId !== null) {
        setDeleteScopeItem(target);
        return;
      }
      setScheduleItems((prev) => prev.filter((s) => s.id !== id));
      ds.softDeleteScheduleItem(id).catch((err) => {
        console.error("[BriefingScreen] schedule delete failed", err);
      });
      push?.("scheduleItem", {
        label: "deleteScheduleItem",
        undo: () => {
          setScheduleItems((prev) =>
            prev.some((s) => s.id === id) ? prev : [...prev, target],
          );
          void ds.restoreScheduleItem(id).catch((err) => {
            console.error("[BriefingScreen] schedule delete undo failed", err);
          });
        },
        redo: () => {
          setScheduleItems((prev) => prev.filter((s) => s.id !== id));
          void ds.softDeleteScheduleItem(id).catch((err) => {
            console.error("[BriefingScreen] schedule delete redo failed", err);
          });
        },
      });
    },
    [ds, scheduleItems, push],
  );

  /*
   * Apply the this/future/all answer. Semantics are Schedule's contract
   * (useScheduleMutations #279), reproduced against the DataService:
   *   this   — Dismiss the single day (a delete would be regenerated)
   *   future — detach the series from this occurrence's date
   *   all    — soft-delete the routine with its cascade (Trash-restorable)
   *
   * Schedule additionally materialises the days between today and a FUTURE
   * anchor before detaching. The paper has no such case: its anchor is always
   * the day it is showing, so that fill is a no-op by construction.
   *
   * No undo command: the routine paths are exactly the ones Schedule leaves
   * off the stack too (a cascade is not reversible by re-inserting one row) —
   * Trash is the recovery path for「すべて」.
   */
  const handleDeleteScopeChoose = useCallback(
    (scope: RepeatScope) => {
      const target = deleteScopeItem;
      setDeleteScopeItem(null);
      const routineId = target?.routineId;
      if (target === null || routineId === undefined || routineId === null) {
        return;
      }
      if (scope === "this") {
        setScheduleItems((prev) => prev.filter((s) => s.id !== target.id));
        void ds.dismissScheduleItem(target.id).catch((err) => {
          console.error("[BriefingScreen] routine dismiss failed", err);
        });
        return;
      }
      const applyRemoval = (deletedIds: string[]) => {
        const removed = new Set(deletedIds);
        setScheduleItems((prev) => prev.filter((s) => !removed.has(s.id)));
      };
      if (scope === "future") {
        void ds
          .detachRoutine(routineId, target.date)
          .then(({ deletedScheduleItemIds }) => {
            applyRemoval(deletedScheduleItemIds);
            // Survivors keep their row but lose the routine origin, mirroring
            // the server NULLing routine_item_id (so the badge goes away).
            setScheduleItems((prev) =>
              prev.map((s) =>
                s.routineId === routineId
                  ? { ...s, routineId: null, sourceDate: null }
                  : s,
              ),
            );
          })
          .catch((err) => {
            console.error("[BriefingScreen] routine detach failed", err);
          });
        return;
      }
      void ds
        .softDeleteRoutine(routineId)
        .then(({ deletedScheduleItemIds }) => {
          applyRemoval(deletedScheduleItemIds);
        })
        .catch((err) => {
          console.error("[BriefingScreen] routine delete failed", err);
        });
    },
    [ds, deleteScopeItem],
  );

  const closeDeleteScope = useCallback(() => setDeleteScopeItem(null), []);

  const handleDeleteTask = useCallback(
    (id: string) => {
      const target = taskNodes.find((n) => n.id === id);
      if (target === undefined) return;
      const markDeleted = (deleted: boolean) => {
        setTaskNodes((prev) =>
          prev.map((n) =>
            n.id === id
              ? {
                  ...n,
                  isDeleted: deleted,
                  deletedAt: deleted ? new Date().toISOString() : undefined,
                }
              : n,
          ),
        );
      };
      markDeleted(true);
      ds.softDeleteTodo(id).catch((err) => {
        console.error("[BriefingScreen] task delete failed", err);
      });
      push?.("taskTree", {
        label: "deleteTask",
        undo: () => {
          markDeleted(false);
          void ds.restoreTodo(id).catch((err) => {
            console.error("[BriefingScreen] task delete undo failed", err);
          });
        },
        redo: () => {
          markDeleted(true);
          void ds.softDeleteTodo(id).catch((err) => {
            console.error("[BriefingScreen] task delete redo failed", err);
          });
        },
      });
    },
    [ds, taskNodes, push],
  );

  // ── Today's Todo tray (rightSidebar — #413) ──────────────────────────
  // The SAME <TodayTodoTray> the Schedule rightSidebar mounts (#298), backed
  // by the same pure selectors: today's task chips split into placed (has a
  // time) and unplaced (all-day candidate), plus pickAddableTasks for the
  // "add from tasks" picker. One implementation, two hosts — a second copy
  // here would drift the moment one side is fixed.
  //
  // Host difference: Briefing mounts no TodoTreeProvider (MainScreen renders
  // this screen bare and injects the DataService instead), so completion and
  // "add to today" write through ds.updateTodo rather than the provider's
  // setTodoStatus / updateNode. Both end up on the same items_meta +
  // tasks_payload columns (todoUpdatesToPatches), so the two trays agree.
  //
  // "Today" here is Briefing's own todayKey (todayDateKey — day-start-hour
  // aware, #373), NOT Schedule's plain calendar key: the tray sits beside the
  // paper's 今日の Todo list and has to agree with it. The two definitions
  // differ only between midnight and the configured day-start hour.
  const todayChips = useMemo(
    () => tasksToCalendarChips(liveTasks, todayKey, todayKey),
    [liveTasks, todayKey],
  );
  // The chips carry a completed flag, not the three-way status the tray now
  // shows (#796) — read it back off the task the chip came from (statusById).
  const todoPlaced = useMemo<TodayTodoRow[]>(
    () =>
      todayChips
        .filter((c) => !c.isAllDay)
        .map((c) => ({
          id: c.id,
          title: c.title,
          timeLabel: c.startTime,
          completed: c.completed,
          status: statusById.get(c.id) ?? "NOT_STARTED",
        })),
    [todayChips, statusById],
  );
  const todoUnplaced = useMemo<TodayTodoRow[]>(
    () =>
      todayChips
        .filter((c) => c.isAllDay)
        .map((c) => ({
          id: c.id,
          title: c.title,
          completed: c.completed,
          status: statusById.get(c.id) ?? "NOT_STARTED",
        })),
    [todayChips, statusById],
  );
  const todoAddable = useMemo(() => pickAddableTasks(liveTasks), [liveTasks]);

  // "Add to today" (案 c staging — the same write Schedule's tray makes):
  // scheduledAt = today's local midnight + all-day, so the task lands in the
  // unplaced group; giving it a time (a Schedule drag) promotes it to placed.
  const handleAddTodoCandidate = useCallback(
    (taskId: string) => {
      void ds
        .updateTodo(taskId, {
          scheduledAt: localDateTimeToISO(todayKey, "00:00"),
          isAllDay: true,
        })
        .then((updated) => {
          setTaskNodes((prev) =>
            prev.map((n) => (n.id === updated.id ? updated : n)),
          );
        })
        .catch((err) => {
          console.error("[BriefingScreen] add-to-today failed", err);
        });
    },
    [ds, todayKey],
  );

  return {
    loading,
    data,
    dateLine,
    dailyContent,
    setDailyContent,
    remainingTodos,
    upcoming,
    handleToggleScheduleItem,
    handleToggleTask,
    handleSetTaskStatus,
    handleDeleteScheduleItem,
    handleDeleteTask,
    deleteScopeItem,
    handleDeleteScopeChoose,
    closeDeleteScope,
    noteOptions,
    handleCreateEvent,
    handleCreateTask,
    handlePlaceTask,
    todoPlaced,
    todoUnplaced,
    todoAddable,
    handleAddTodoCandidate,
  };
}
