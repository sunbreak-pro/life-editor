import { useEffect, useMemo, useState } from "react";
import {
  useRoutineContext,
  type RoutineNode,
  type FrequencyType,
} from "@life-editor/shared";
import { DebouncedTextInput } from "../components/DebouncedTextInput";

/*
 * Web Schedule UI — S4-3 Routine slice only.
 *
 * Lean, purpose-built ink-token view (NOT a port of the Tauri
 * Schedule screen — the heavy calendar grid / DnD / Achievement UI is
 * intentionally out of scope, plan §スコープ外). It exercises every
 * shared Routine data path the S4-3 surface exposes: routine CRUD +
 * archive/visibility toggles + soft-delete/restore/purge, routine_group
 * CRUD, and routine↔group membership assignment.
 *
 * The Routine→schedule_items generator is S4-5 and is NOT triggered
 * here; ScheduleItems / Calendar views land in S4-4 / S4-6.
 *
 * i18n: the web build has no i18n table yet (a real one arrives with
 * the Settings S-step — same as DailyView / NotesView). English-only,
 * matching the established web convention.
 */

const FREQUENCY_TYPES: FrequencyType[] = [
  "daily",
  "weekdays",
  "interval",
  "group",
];

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function frequencySummary(
  r: Pick<RoutineNode, "frequencyType" | "frequencyDays" | "frequencyInterval">,
): string {
  switch (r.frequencyType) {
    case "daily":
      return "Every day";
    case "weekdays":
      return r.frequencyDays.length > 0
        ? r.frequencyDays
            .slice()
            .sort((a, b) => a - b)
            .map((d) => WEEKDAY_LABELS[d] ?? `?${d}`)
            .join(", ")
        : "No days selected";
    case "interval":
      return r.frequencyInterval && r.frequencyInterval > 0
        ? `Every ${r.frequencyInterval} day(s)`
        : "Interval not set";
    case "group":
      return "Follows assigned groups";
    default:
      return r.frequencyType;
  }
}

export function ScheduleView() {
  const {
    routines,
    deletedRoutines,
    routineGroups,
    isLoading,
    error,
    createRoutine,
    updateRoutine,
    deleteRoutine,
    loadDeletedRoutines,
    restoreRoutine,
    permanentDeleteRoutine,
    createRoutineGroup,
    deleteRoutineGroup,
    setGroupsForRoutine,
    getGroupIdsForRoutine,
  } = useRoutineContext();

  const [newTitle, setNewTitle] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newGroupName, setNewGroupName] = useState("");

  useEffect(() => {
    void loadDeletedRoutines();
  }, [loadDeletedRoutines]);

  const sortedRoutines = useMemo(
    () => routines.slice().sort((a, b) => a.order - b.order),
    [routines],
  );

  const handleCreateRoutine = () => {
    const title = newTitle.trim();
    if (!title) return;
    createRoutine(title, newStart || undefined, newEnd || undefined);
    setNewTitle("");
    setNewStart("");
    setNewEnd("");
  };

  const handleCreateGroup = () => {
    const name = newGroupName.trim();
    if (!name) return;
    void createRoutineGroup(name, "#6b7280");
    setNewGroupName("");
  };

  const toggleGroupMembership = (routine: RoutineNode, groupId: string) => {
    const current = getGroupIdsForRoutine(routine.id);
    const next = current.includes(groupId)
      ? current.filter((g) => g !== groupId)
      : [...current, groupId];
    setGroupsForRoutine(routine.id, next);
  };

  if (isLoading) {
    return (
      <p className="text-sm text-ink-text-secondary">Loading routines…</p>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-ink-text-secondary">
        Could not load routines: {error}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* Create routine */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-text">New routine</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                handleCreateRoutine();
              }
            }}
            placeholder="Routine title"
            className="min-w-[12rem] flex-1 rounded-md border border-ink-border bg-ink-bg px-2 py-1 text-sm text-ink-text"
          />
          <input
            type="time"
            value={newStart}
            onChange={(e) => setNewStart(e.target.value)}
            aria-label="Start time"
            className="rounded-md border border-ink-border bg-ink-bg px-2 py-1 text-sm text-ink-text"
          />
          <input
            type="time"
            value={newEnd}
            onChange={(e) => setNewEnd(e.target.value)}
            aria-label="End time"
            className="rounded-md border border-ink-border bg-ink-bg px-2 py-1 text-sm text-ink-text"
          />
          <button
            type="button"
            onClick={handleCreateRoutine}
            className="rounded-md border border-ink-border px-3 py-1 text-sm text-ink-text hover:bg-ink-hover"
          >
            Add
          </button>
        </div>
      </section>

      {/* Routine groups */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-text">
          Routine groups ({routineGroups.length})
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                handleCreateGroup();
              }
            }}
            placeholder="Group name"
            className="min-w-[10rem] flex-1 rounded-md border border-ink-border bg-ink-bg px-2 py-1 text-sm text-ink-text"
          />
          <button
            type="button"
            onClick={handleCreateGroup}
            className="rounded-md border border-ink-border px-3 py-1 text-sm text-ink-text hover:bg-ink-hover"
          >
            Add group
          </button>
        </div>
        <ul className="space-y-1">
          {routineGroups.map((g) => (
            <li
              key={g.id}
              className="flex items-center justify-between rounded-md border border-ink-border px-2 py-1 text-sm text-ink-text"
            >
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: g.color }}
                />
                {g.name}
              </span>
              <button
                type="button"
                onClick={() => void deleteRoutineGroup(g.id)}
                className="rounded-md border border-ink-border px-2 py-0.5 text-xs text-ink-text hover:bg-ink-hover"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Routines */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-text">
          Routines ({sortedRoutines.length})
        </h2>
        <ul className="space-y-2">
          {sortedRoutines.map((r) => (
            <li
              key={r.id}
              className="space-y-2 rounded-md border border-ink-border p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <DebouncedTextInput
                  key={`title-${r.id}`}
                  value={r.title}
                  onCommit={(title) => updateRoutine(r.id, { title })}
                  className="min-w-[10rem] flex-1 rounded-md border border-ink-border bg-ink-bg px-2 py-1 text-sm text-ink-text"
                />
                <DebouncedTextInput
                  key={`start-${r.id}`}
                  type="time"
                  value={r.startTime ?? ""}
                  onCommit={(v) =>
                    updateRoutine(r.id, { startTime: v || null })
                  }
                  aria-label={`Start time for ${r.title}`}
                  className="rounded-md border border-ink-border bg-ink-bg px-2 py-1 text-sm text-ink-text"
                />
                <DebouncedTextInput
                  key={`end-${r.id}`}
                  type="time"
                  value={r.endTime ?? ""}
                  onCommit={(v) => updateRoutine(r.id, { endTime: v || null })}
                  aria-label={`End time for ${r.title}`}
                  className="rounded-md border border-ink-border bg-ink-bg px-2 py-1 text-sm text-ink-text"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm">
                <label className="flex items-center gap-1 text-ink-text-secondary">
                  Frequency
                  <select
                    value={r.frequencyType}
                    onChange={(e) =>
                      updateRoutine(r.id, {
                        frequencyType: e.target.value as FrequencyType,
                      })
                    }
                    className="rounded-md border border-ink-border bg-ink-bg px-2 py-1 text-ink-text"
                  >
                    {FREQUENCY_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="text-ink-text-secondary">
                  {frequencySummary(r)}
                </span>
              </div>

              {r.frequencyType === "weekdays" && (
                <div className="flex flex-wrap gap-1">
                  {WEEKDAY_LABELS.map((label, dayIdx) => {
                    const active = r.frequencyDays.includes(dayIdx);
                    return (
                      <button
                        key={label}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          const next = active
                            ? r.frequencyDays.filter((d) => d !== dayIdx)
                            : [...r.frequencyDays, dayIdx];
                          updateRoutine(r.id, { frequencyDays: next });
                        }}
                        className={`rounded-md border border-ink-border px-2 py-0.5 text-xs ${
                          active
                            ? "bg-ink-hover text-ink-text"
                            : "text-ink-text-secondary hover:bg-ink-hover"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}

              {r.frequencyType === "interval" && (
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1 text-sm text-ink-text-secondary">
                    Every
                    <input
                      type="number"
                      min={1}
                      value={r.frequencyInterval ?? 1}
                      onChange={(e) =>
                        updateRoutine(r.id, {
                          frequencyInterval: Number(e.target.value) || 1,
                        })
                      }
                      className="w-16 rounded-md border border-ink-border bg-ink-bg px-2 py-1 text-ink-text"
                    />
                    day(s)
                  </label>
                  {/*
                   * The interval generator counts whole days from this
                   * anchor (routineFrequency.ts: diffDays % interval).
                   * Without it `shouldRoutineRunOnDate` degrades to
                   * "every day" — so the start date is required for a
                   * meaningful interval routine (SSOT 申し送り③ / S4-3
                   * Nit2). Stored as a local `YYYY-MM-DD` key (no UTC).
                   */}
                  <label className="flex items-center gap-1 text-sm text-ink-text-secondary">
                    From
                    <input
                      type="date"
                      value={r.frequencyStartDate ?? ""}
                      onChange={(e) =>
                        updateRoutine(r.id, {
                          frequencyStartDate: e.target.value || null,
                        })
                      }
                      aria-label={`Interval start date for ${r.title}`}
                      className="rounded-md border border-ink-border bg-ink-bg px-2 py-1 text-ink-text"
                    />
                  </label>
                </div>
              )}

              {/*
               * RoutineGroup membership UI — frequencyType に依存せず常時
               * 表示 (DU-C-6 後 UX 改善 2026-05-24)。所属中のグループは
               * 色付きバッジ + 「×」で削除、未所属のグループは破線の
               * 「+ name」で追加できる。
               *
               * frequencyType === "group" の時のみ membership が頻度
               * 判定に効く (frequencySummary "Follows assigned groups")。
               * それ以外の frequencyType でも membership 自体は記録され、
               * 後で "group" に切り替えた時にそのまま反映される。
               */}
              {routineGroups.length > 0 &&
                (() => {
                  const memberIds = getGroupIdsForRoutine(r.id);
                  const members = routineGroups.filter((g) =>
                    memberIds.includes(g.id),
                  );
                  const nonMembers = routineGroups.filter(
                    (g) => !memberIds.includes(g.id),
                  );
                  return (
                    <div className="flex flex-wrap items-center gap-1 text-xs">
                      <span className="text-ink-text-secondary">
                        Groups:
                      </span>
                      {members.length === 0 && (
                        <span className="italic text-ink-text-secondary">
                          none
                        </span>
                      )}
                      {members.map((g) => (
                        <button
                          key={`m-${g.id}`}
                          type="button"
                          onClick={() => toggleGroupMembership(r, g.id)}
                          aria-label={`Remove ${r.title} from group ${g.name}`}
                          className="inline-flex items-center gap-1 rounded-md border border-ink-border bg-ink-hover px-2 py-0.5 text-ink-text hover:opacity-80"
                        >
                          <span
                            aria-hidden
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: g.color }}
                          />
                          {g.name}
                          <span
                            aria-hidden
                            className="ml-0.5 text-ink-text-secondary"
                          >
                            ×
                          </span>
                        </button>
                      ))}
                      {nonMembers.length > 0 && (
                        <>
                          <span
                            aria-hidden
                            className="mx-1 text-ink-text-secondary"
                          >
                            |
                          </span>
                          <span className="text-ink-text-secondary">
                            Add:
                          </span>
                          {nonMembers.map((g) => (
                            <button
                              key={`n-${g.id}`}
                              type="button"
                              onClick={() => toggleGroupMembership(r, g.id)}
                              aria-label={`Add ${r.title} to group ${g.name}`}
                              className="inline-flex items-center gap-1 rounded-md border border-dashed border-ink-border px-2 py-0.5 text-ink-text-secondary hover:bg-ink-hover hover:text-ink-text"
                            >
                              <span
                                aria-hidden
                                className="inline-block h-2 w-2 rounded-full opacity-40"
                                style={{ backgroundColor: g.color }}
                              />
                              + {g.name}
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  );
                })()}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    updateRoutine(r.id, { isArchived: !r.isArchived })
                  }
                  className="rounded-md border border-ink-border px-2 py-0.5 text-xs text-ink-text hover:bg-ink-hover"
                >
                  {r.isArchived ? "Unarchive" : "Archive"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateRoutine(r.id, { isVisible: !r.isVisible })
                  }
                  className="rounded-md border border-ink-border px-2 py-0.5 text-xs text-ink-text hover:bg-ink-hover"
                >
                  {r.isVisible ? "Hide" : "Show"}
                </button>
                <button
                  type="button"
                  onClick={() => void deleteRoutine(r.id)}
                  className="rounded-md border border-ink-border px-2 py-0.5 text-xs text-ink-text hover:bg-ink-hover"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {deletedRoutines.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-ink-text">
            Trash ({deletedRoutines.length})
          </h2>
          <ul className="space-y-1">
            {deletedRoutines.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between text-sm text-ink-text-secondary"
              >
                <span>{r.title}</span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => restoreRoutine(r.id)}
                    className="rounded-md border border-ink-border px-2 py-0.5 text-xs text-ink-text hover:bg-ink-hover"
                  >
                    Restore
                  </button>
                  <button
                    type="button"
                    onClick={() => permanentDeleteRoutine(r.id)}
                    className="rounded-md border border-ink-border px-2 py-0.5 text-xs text-ink-text hover:bg-ink-hover"
                  >
                    Delete forever
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
