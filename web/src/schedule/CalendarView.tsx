import { useMemo, useState } from "react";
import { useCalendarContext, useTaskTreeContext } from "@life-editor/shared";

/*
 * Web Schedule UI — S4-6 Calendars slice.
 *
 * Lean, purpose-built notion-token view (NOT a port of the Tauri
 * calendar grid — intentionally out of scope, plan §スコープ外). It
 * exercises every shared `calendars` data path S4-6 exposes: create
 * (title + folderId — a calendar is a folder-scoped view, folder_id FKs
 * tasks(id) with ON DELETE CASCADE), inline title edit, physical
 * delete.
 *
 * bug1 fix: folderId is no longer free-text. A free-text id that does
 * not exist in tasks(id) raised 409 calendars_folder_id_fkey on insert.
 * It is now a <select> over the folder-type tasks from
 * useTaskTreeContext (the same model the Tauri CalendarView uses —
 * getDescendantTasks(activeCalendar.folderId, nodes) walks an existing
 * folder task). If no folder task exists, Add is disabled with a hint.
 *
 * `calendars` has NO
 * trash path (S4-0: 0006 omits is_deleted — physical-delete only), so
 * there is deliberately no Restore section here (cf. ScheduleItemsView).
 *
 * i18n: the web build has no i18n table yet (a real one arrives with
 * the Settings S-step — same as ScheduleView / NotesView). English-only,
 * matching the established web convention (S4-3/4/5 一貫).
 */

export function CalendarView() {
  const {
    calendars,
    isLoading,
    error,
    createCalendar,
    updateCalendar,
    deleteCalendar,
  } = useCalendarContext();

  const { nodes } = useTaskTreeContext();
  const folderTasks = useMemo(
    () =>
      nodes
        .filter((n) => n.type === "folder")
        .slice()
        .sort((a, b) => a.title.localeCompare(b.title)),
    [nodes],
  );
  const folderTitleById = useMemo(
    () => new Map(folderTasks.map((f) => [f.id, f.title])),
    [folderTasks],
  );

  const [newTitle, setNewTitle] = useState("");
  const [newFolderId, setNewFolderId] = useState("");

  const handleCreate = () => {
    const title = newTitle.trim();
    const folderId = newFolderId;
    if (!title || !folderId) return;
    // Guard: only allow ids that resolve to a known folder task — a
    // stale/unknown id would still trip calendars_folder_id_fkey (409).
    if (!folderTitleById.has(folderId)) return;
    createCalendar(title, folderId);
    setNewTitle("");
    setNewFolderId("");
  };

  if (isLoading) {
    return (
      <p className="text-sm text-notion-text-secondary">Loading calendars…</p>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-notion-text-secondary">
        Could not load calendars: {error}
      </p>
    );
  }

  return (
    <section className="space-y-3 rounded-md border border-notion-border p-3">
      <h2 className="text-sm font-semibold text-notion-text">
        Calendars ({calendars.length})
      </h2>

      {folderTasks.length === 0 ? (
        <p className="text-sm text-notion-text-secondary">
          フォルダタスクを先に作成してください。カレンダーは既存のフォルダ
          タスクに紐づくビューです (folder-type task が 0 件のため作成不可)。
        </p>
      ) : (
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
            placeholder="Calendar title"
            className="min-w-[10rem] flex-1 rounded-md border border-notion-border bg-notion-bg px-2 py-1 text-sm text-notion-text"
          />
          <select
            value={newFolderId}
            onChange={(e) => setNewFolderId(e.target.value)}
            aria-label="Folder task"
            className="min-w-[8rem] flex-1 rounded-md border border-notion-border bg-notion-bg px-2 py-1 text-sm text-notion-text"
          >
            <option value="">Select a folder…</option>
            {folderTasks.map((f) => (
              <option key={f.id} value={f.id}>
                {f.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!newTitle.trim() || !newFolderId}
            className="rounded-md border border-notion-border px-3 py-1 text-sm text-notion-text hover:bg-notion-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add
          </button>
        </div>
      )}

      <ul className="space-y-2">
        {calendars.map((cal) => (
          <li
            key={cal.id}
            className="flex flex-wrap items-center gap-2 rounded-md border border-notion-border p-2"
          >
            <input
              type="text"
              value={cal.title}
              onChange={(e) =>
                updateCalendar(cal.id, { title: e.target.value })
              }
              aria-label={`Title for ${cal.title}`}
              className="min-w-[8rem] flex-1 rounded-md border border-notion-border bg-notion-bg px-2 py-1 text-sm text-notion-text"
            />
            <span className="text-xs text-notion-text-secondary">
              folder: {folderTitleById.get(cal.folderId) ?? cal.folderId}
            </span>
            <button
              type="button"
              onClick={() => deleteCalendar(cal.id)}
              className="rounded-md border border-notion-border px-2 py-0.5 text-xs text-notion-text hover:bg-notion-hover"
            >
              Delete
            </button>
          </li>
        ))}
        {calendars.length === 0 && (
          <li className="text-sm text-notion-text-secondary">
            No calendars yet.
          </li>
        )}
      </ul>
    </section>
  );
}
