import { useMemo, useState } from "react";
import {
  useScheduleItemsContext,
  useTaskTreeContext,
} from "@life-editor/shared";
import { TagPicker, LinkPanel } from "../wikitag";
import { DebouncedTextInput } from "../components/DebouncedTextInput";

/*
 * Web Schedule UI — S4-4 ScheduleItems slice.
 *
 * Lean, purpose-built ink-token view (NOT a port of the Tauri
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
 * bug2 fix (Issue 017 ghost-revival): a routine-generated item
 * (routineId != null) must NOT be reachable via soft-delete or
 * "Delete forever". While its routine is live the generator
 * (RoutineScheduleSync) re-materialises (routine_id,date) every
 * date/routine change, so a physical/soft delete just resurrects the
 * row. The only routine-consistent way to remove an occurrence is
 * Dismiss (is_dismissed=true, is_deleted=false) — the (routine_id,date)
 * dedup guard in SupabaseDataService then keeps the generator from
 * re-creating it. So for routine items we expose ONLY Dismiss, hide
 * Delete + Delete-forever, and never list them in Trash. Manual items
 * (routineId === null) keep the full soft-delete / Trash / forever
 * lifecycle unchanged. (To delete every occurrence of a routine, delete
 * the routine itself from ScheduleView — softDeleteRoutine cascades.)
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
  const taskTree = useTaskTreeContext();

  const [newTitle, setNewTitle] = useState("");
  const [newStart, setNewStart] = useState("09:00");
  const [newEnd, setNewEnd] = useState("10:00");
  // Per-item detail toggle for the Tag/Link panel (DU-F Step 7).
  // Local Set rather than a useExpanded hook — this is single-section state.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Linkable candidates pool: own schedule_items (same date set) + every
  // task. DU-F MVP wiring — DU-G unifies into items_meta and removes the
  // per-role plumbing.
  const linkableItems = useMemo(() => {
    const out: Array<{ id: string; label: string }> = [];
    for (const i of items) out.push({ id: i.id, label: `[event] ${i.title}` });
    const walk = (parentId: string | null) => {
      for (const node of taskTree.getChildren(parentId)) {
        out.push({
          id: node.id,
          label: `[${node.type}] ${node.title || "(untitled)"}`,
        });
        walk(node.id);
      }
    };
    walk(null);
    return out;
  }, [items, taskTree]);

  const resolveTitle = (id: string): string | undefined => {
    const ev = items.find((i) => i.id === id);
    if (ev) return `[event] ${ev.title}`;
    const t = taskTree.nodeMap.get(id);
    if (t) return `[${t.type}] ${t.title || "(untitled)"}`;
    return undefined;
  };

  const sortedItems = useMemo(
    () => items.slice().sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [items],
  );

  // bug2: routine items never enter the soft-delete lifecycle (Dismiss
  // only), so they must not appear in Trash even if a stray soft-delete
  // row exists. Only manual items (routineId === null) are restorable.
  const deletedManualItems = useMemo(
    () => deletedItems.filter((i) => !i.routineId),
    [deletedItems],
  );

  const handleCreate = () => {
    const title = newTitle.trim();
    if (!title) return;
    createScheduleItem(date ?? todayLocal(), title, newStart, newEnd);
    setNewTitle("");
  };

  if (isLoading) {
    return (
      <p className="text-sm text-ink-text-secondary">
        Loading schedule items…
      </p>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-ink-text-secondary">
        Could not load schedule items: {error}
      </p>
    );
  }

  return (
    <section className="space-y-3 rounded-md border border-ink-border p-3">
      <h2 className="text-sm font-semibold text-ink-text">
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
          className="min-w-[10rem] flex-1 rounded-md border border-ink-border bg-ink-bg px-2 py-1 text-sm text-ink-text"
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
          onClick={handleCreate}
          className="rounded-md border border-ink-border px-3 py-1 text-sm text-ink-text hover:bg-ink-hover"
        >
          Add
        </button>
      </div>

      {/* Items */}
      <ul className="space-y-2">
        {sortedItems.map((item) => (
          <li
            key={item.id}
            className={`space-y-2 rounded-md border border-ink-border p-2 ${
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
              <DebouncedTextInput
                key={`title-${item.id}`}
                value={item.title}
                onCommit={(title) => updateScheduleItem(item.id, { title })}
                className={`min-w-[8rem] flex-1 rounded-md border border-ink-border bg-ink-bg px-2 py-1 text-sm text-ink-text ${
                  item.completed ? "line-through" : ""
                }`}
              />
              <DebouncedTextInput
                key={`start-${item.id}`}
                type="time"
                value={item.startTime}
                onCommit={(startTime) =>
                  updateScheduleItem(item.id, { startTime })
                }
                aria-label={`Start time for ${item.title}`}
                className="rounded-md border border-ink-border bg-ink-bg px-2 py-1 text-sm text-ink-text"
              />
              <DebouncedTextInput
                key={`end-${item.id}`}
                type="time"
                value={item.endTime}
                onCommit={(endTime) => updateScheduleItem(item.id, { endTime })}
                aria-label={`End time for ${item.title}`}
                className="rounded-md border border-ink-border bg-ink-bg px-2 py-1 text-sm text-ink-text"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {item.routineId && (
                <span className="text-xs text-ink-text-secondary">
                  from routine
                </span>
              )}
              <TagPicker itemId={item.id} />
              <button
                type="button"
                onClick={() => toggleExpanded(item.id)}
                aria-expanded={expanded.has(item.id)}
                className="rounded-md border border-ink-border px-2 py-0.5 text-xs text-ink-text hover:bg-ink-hover"
              >
                {expanded.has(item.id) ? "Hide links" : "Links"}
              </button>
              <button
                type="button"
                onClick={() =>
                  item.isDismissed ? undismiss(item.id) : dismiss(item.id)
                }
                className="rounded-md border border-ink-border px-2 py-0.5 text-xs text-ink-text hover:bg-ink-hover"
              >
                {item.isDismissed ? "Undismiss" : "Dismiss"}
              </button>
              {/*
               * Routine items (routineId != null) get Dismiss only —
               * soft-delete would be undone by the generator while the
               * routine is live (Issue 017). Manual items keep Delete.
               */}
              {!item.routineId && (
                <button
                  type="button"
                  onClick={() => deleteScheduleItem(item.id)}
                  className="rounded-md border border-ink-border px-2 py-0.5 text-xs text-ink-text hover:bg-ink-hover"
                >
                  Delete
                </button>
              )}
            </div>
            {expanded.has(item.id) && (
              <LinkPanel
                itemId={item.id}
                resolveTitle={resolveTitle}
                linkableItems={linkableItems}
              />
            )}
          </li>
        ))}
        {sortedItems.length === 0 && (
          <li className="text-sm text-ink-text-secondary">
            No schedule items for this date.
          </li>
        )}
      </ul>

      {deletedManualItems.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-ink-text">
            Trash ({deletedManualItems.length})
          </h3>
          <ul className="space-y-1">
            {deletedManualItems.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between text-sm text-ink-text-secondary"
              >
                <span>
                  {item.date} · {item.title}
                </span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => restoreScheduleItem(item.id)}
                    className="rounded-md border border-ink-border px-2 py-0.5 text-xs text-ink-text hover:bg-ink-hover"
                  >
                    Restore
                  </button>
                  <button
                    type="button"
                    onClick={() => permanentDeleteScheduleItem(item.id)}
                    className="rounded-md border border-ink-border px-2 py-0.5 text-xs text-ink-text hover:bg-ink-hover"
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
