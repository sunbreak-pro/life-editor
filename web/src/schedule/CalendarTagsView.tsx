import { useState } from "react";
import {
  useCalendarTagsContextOptional,
  useScheduleItemsContext,
} from "@life-editor/shared";

/*
 * Web Schedule UI — S4-6 CalendarTags slice (last of the trio).
 *
 * Lean, purpose-built notion-token view (faithful port surface only —
 * no new CalendarTag features, plan §スコープ外). It exercises every
 * shared CalendarTags data path S4-6 exposes:
 *   - calendar_tag_definitions: create / inline name+color edit / delete
 *     (delete cascades cta + bumps parents in the DataService layer)
 *   - calendar_tag_assignments: 1:1 assign/clear a tag on the anchored
 *     date's schedule_items (entity_type = "schedule_item")
 *
 * Mobile Optional contract (CLAUDE.md §2 / vision/coding-principles.md
 * §4): CalendarTags is a Mobile 省略 Provider. This view reads the
 * Optional hook and renders nothing when the Provider is absent — the
 * exact pattern a shared component must use so it never crashes on
 * iOS/Android. (The web build is Desktop-shaped and DOES mount the
 * Provider, so the guard is normally inert; it proves the Optional
 * variant is wired and Provider-absence-safe.)
 *
 * i18n: English-only, matching the established web convention (S4-3/4/5
 * 一貫 — a real i18n table arrives with the Settings S-step).
 */

export function CalendarTagsView() {
  const ctx = useCalendarTagsContextOptional();
  const { items } = useScheduleItemsContext();

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#4f9dde");

  // Mobile-safe guard: CalendarTagsProvider may be absent (Mobile 省略
  // Provider). A shared component returns null here; on Desktop/web the
  // Provider is mounted so this is not taken.
  if (!ctx) return null;

  const {
    tags,
    isLoading,
    error,
    createCalendarTag,
    updateCalendarTag,
    deleteCalendarTag,
    setTagForEntity,
    getTagForEntity,
  } = ctx;

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    void createCalendarTag(name, newColor);
    setNewName("");
  };

  if (isLoading) {
    return (
      <p className="text-sm text-notion-text-secondary">
        Loading calendar tags…
      </p>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-notion-text-secondary">
        Could not load calendar tags: {error}
      </p>
    );
  }

  return (
    <section className="space-y-3 rounded-md border border-notion-border p-3">
      <h2 className="text-sm font-semibold text-notion-text">
        Calendar tags ({tags.length})
      </h2>

      {/* Define tags */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              handleCreate();
            }
          }}
          placeholder="Tag name"
          className="min-w-[10rem] flex-1 rounded-md border border-notion-border bg-notion-bg px-2 py-1 text-sm text-notion-text"
        />
        <input
          type="color"
          value={newColor}
          onChange={(e) => setNewColor(e.target.value)}
          aria-label="Tag color"
          className="h-8 w-10 rounded-md border border-notion-border bg-notion-bg"
        />
        <button
          type="button"
          onClick={handleCreate}
          className="rounded-md border border-notion-border px-3 py-1 text-sm text-notion-text hover:bg-notion-hover"
        >
          Add
        </button>
      </div>

      <ul className="space-y-2">
        {tags.map((tag) => (
          <li
            key={tag.id}
            className="flex flex-wrap items-center gap-2 rounded-md border border-notion-border p-2"
          >
            <input
              type="text"
              value={tag.name}
              onChange={(e) =>
                updateCalendarTag(tag.id, { name: e.target.value })
              }
              aria-label={`Name for ${tag.name}`}
              className="min-w-[8rem] flex-1 rounded-md border border-notion-border bg-notion-bg px-2 py-1 text-sm text-notion-text"
            />
            <input
              type="color"
              value={tag.color}
              onChange={(e) =>
                updateCalendarTag(tag.id, { color: e.target.value })
              }
              aria-label={`Color for ${tag.name}`}
              className="h-8 w-10 rounded-md border border-notion-border bg-notion-bg"
            />
            <button
              type="button"
              onClick={() => deleteCalendarTag(tag.id)}
              className="rounded-md border border-notion-border px-2 py-0.5 text-xs text-notion-text hover:bg-notion-hover"
            >
              Delete
            </button>
          </li>
        ))}
        {tags.length === 0 && (
          <li className="text-sm text-notion-text-secondary">
            No calendar tags yet.
          </li>
        )}
      </ul>

      {/* 1:1 assignment to the anchored date's schedule_items */}
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-notion-text">
          Tag schedule items
        </h3>
        <ul className="space-y-1">
          {items.map((item) => {
            const current = getTagForEntity("schedule_item", item.id);
            return (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-2 text-sm text-notion-text"
              >
                <span className="min-w-[8rem] flex-1">{item.title}</span>
                <select
                  value={current ?? ""}
                  onChange={(e) =>
                    setTagForEntity(
                      "schedule_item",
                      item.id,
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                  aria-label={`Tag for ${item.title}`}
                  className="rounded-md border border-notion-border bg-notion-bg px-2 py-1 text-sm text-notion-text"
                >
                  <option value="">(no tag)</option>
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </li>
            );
          })}
          {items.length === 0 && (
            <li className="text-sm text-notion-text-secondary">
              No schedule items on this date to tag.
            </li>
          )}
        </ul>
      </div>
    </section>
  );
}
