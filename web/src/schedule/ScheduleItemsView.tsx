import { useMemo, useState } from "react";
import { useScheduleItemsContext } from "@life-editor/shared";

/*
 * Web Schedule UI — S4-4 ScheduleItems slice.
 *
 * Lean, purpose-built notion-token view (NOT a port of the Tauri
 * Schedule calendar grid / DnD / Achievement UI — intentionally out of
 * scope, plan §スコープ外). It exercises every shared schedule_items
 * data path the S4-4 surface exposes for the anchored date: manual
 * create, inline edit (title/time), complete toggle, dismiss/undismiss,
 * soft-delete + restore + purge.
 *
 * The Routine→schedule_items generator is S4-5 and is NOT triggered
 * here — every item created from this view is a MANUAL item
 * (routineId = null). Calendar / CalendarTags views land in S4-6.
 *
 * i18n: the web build has no i18n table yet (a real one arrives with
 * the Settings S-step — same as DailyView / NotesView / ScheduleView).
 * English-only, matching the established web convention (S4-3 一貫).
 */

function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function ScheduleItemsView() {
  const {
    date,
    items,
    deletedItems,
    isLoading,
    error,
    createScheduleItem,
    updateScheduleItem,
    toggleComplete,
    dismiss,
    undismiss,
    deleteScheduleItem,
    restoreScheduleItem,
    permanentDeleteScheduleItem,
  } = useScheduleItemsContext();

  const [newTitle, setNewTitle] = useState("");
  const [newStart, setNewStart] = useState("09:00");
  const [newEnd, setNewEnd] = useState("10:00");

  const sortedItems = useMemo(
    () => items.slice().sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [items],
  );

  const handleCreate = () => {
    const title = newTitle.trim();
    if (!title) return;
    createScheduleItem(date ?? todayLocal(), title, newStart, newEnd);
    setNewTitle("");
  };

  if (isLoading) {
    return (
      <p className="text-sm text-notion-text-secondary">
        Loading schedule items…
      </p>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-notion-text-secondary">
        Could not load schedule items: {error}
      </p>
    );
  }

  return (
    <section className="space-y-3 rounded-md border border-notion-border p-3">
      <h2 className="text-sm font-semibold text-notion-text">
        Schedule items — {date} ({sortedItems.length})
      </h2>

      {/* Create manual item */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              handleCreate();
            }
          }}
          placeholder="Item title"
          className="min-w-[10rem] flex-1 rounded-md border border-notion-border bg-notion-bg px-2 py-1 text-sm text-notion-text"
        />
        <input
          type="time"
          value={newStart}
          onChange={(e) => setNewStart(e.target.value)}
          aria-label="Start time"
          className="rounded-md border border-notion-border bg-notion-bg px-2 py-1 text-sm text-notion-text"
        />
        <input
          type="time"
          value={newEnd}
          onChange={(e) => setNewEnd(e.target.value)}
          aria-label="End time"
          className="rounded-md border border-notion-border bg-notion-bg px-2 py-1 text-sm text-notion-text"
        />
        <button
          type="button"
          onClick={handleCreate}
          className="rounded-md border border-notion-border px-3 py-1 text-sm text-notion-text hover:bg-notion-hover"
        >
          Add
        </button>
      </div>

      {/* Items */}
      <ul className="space-y-2">
        {sortedItems.map((item) => (
          <li
            key={item.id}
            className={`space-y-2 rounded-md border border-notion-border p-2 ${
              item.isDismissed ? "opacity-60" : ""
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="checkbox"
                checked={item.completed}
                onChange={() => toggleComplete(item.id)}
                aria-label={`Mark ${item.title} complete`}
              />
              <input
                type="text"
                value={item.title}
                onChange={(e) =>
                  updateScheduleItem(item.id, { title: e.target.value })
                }
                className={`min-w-[8rem] flex-1 rounded-md border border-notion-border bg-notion-bg px-2 py-1 text-sm text-notion-text ${
                  item.completed ? "line-through" : ""
                }`}
              />
              <input
                type="time"
                value={item.startTime}
                onChange={(e) =>
                  updateScheduleItem(item.id, { startTime: e.target.value })
                }
                aria-label={`Start time for ${item.title}`}
                className="rounded-md border border-notion-border bg-notion-bg px-2 py-1 text-sm text-notion-text"
              />
              <input
                type="time"
                value={item.endTime}
                onChange={(e) =>
                  updateScheduleItem(item.id, { endTime: e.target.value })
                }
                aria-label={`End time for ${item.title}`}
                className="rounded-md border border-notion-border bg-notion-bg px-2 py-1 text-sm text-notion-text"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {item.routineId && (
                <span className="text-xs text-notion-text-secondary">
                  from routine
                </span>
              )}
              <button
                type="button"
                onClick={() =>
                  item.isDismissed ? undismiss(item.id) : dismiss(item.id)
                }
                className="rounded-md border border-notion-border px-2 py-0.5 text-xs text-notion-text hover:bg-notion-hover"
              >
                {item.isDismissed ? "Undismiss" : "Dismiss"}
              </button>
              <button
                type="button"
                onClick={() => deleteScheduleItem(item.id)}
                className="rounded-md border border-notion-border px-2 py-0.5 text-xs text-notion-text hover:bg-notion-hover"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
        {sortedItems.length === 0 && (
          <li className="text-sm text-notion-text-secondary">
            No schedule items for this date.
          </li>
        )}
      </ul>

      {deletedItems.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-notion-text">
            Trash ({deletedItems.length})
          </h3>
          <ul className="space-y-1">
            {deletedItems.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between text-sm text-notion-text-secondary"
              >
                <span>
                  {item.date} · {item.title}
                </span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => restoreScheduleItem(item.id)}
                    className="rounded-md border border-notion-border px-2 py-0.5 text-xs text-notion-text hover:bg-notion-hover"
                  >
                    Restore
                  </button>
                  <button
                    type="button"
                    onClick={() => permanentDeleteScheduleItem(item.id)}
                    className="rounded-md border border-notion-border px-2 py-0.5 text-xs text-notion-text hover:bg-notion-hover"
                  >
                    Delete forever
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
