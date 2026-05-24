import { useEffect, useMemo, useState } from "react";
import { useDailyContext } from "@life-editor/shared";
import { TagPicker, LinkPanel } from "../wikitag";

/*
 * Web Daily UI (S2). The heavy Tauri Daily (TipTap rich editor,
 * password/lock dialogs, sidebar grouping, i18n) is intentionally NOT
 * ported here — TipTap is an S3 cross-cutting concern (Phase 2 plan S3:
 * "TipTap 依存確認"). This is a functional, notion-token-styled view
 * that exercises every shared daily data path: date select, load,
 * UPSERT-on-edit (the S2 acceptance criterion), pin toggle, soft-delete
 * + restore. Content is a plain <textarea> (rich text deferred to S3).
 */

function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

export function DailyView() {
  const {
    dailies,
    deletedDailies,
    selectedDate,
    setSelectedDate,
    selectedDaily,
    upsertDaily,
    deleteDaily,
    togglePin,
    restoreDaily,
    loadDeletedDailies,
  } = useDailyContext();

  // The editable draft mirrors the selected daily's stored content. It is
  // resynced when the selection changes OR when the persisted content for
  // the current selection changes (e.g. it finishes loading / a refetch
  // lands). Done with React's "adjust state during render" pattern
  // (https://react.dev/learn/you-might-not-need-an-effect) rather than an
  // effect: a setState-in-effect for prop-derived state causes the
  // cascading-render lint error and an extra commit.
  const [draft, setDraft] = useState(selectedDaily?.content ?? "");
  const [syncedFrom, setSyncedFrom] = useState<{
    date: string;
    content: string;
  }>({ date: selectedDate, content: selectedDaily?.content ?? "" });

  const selectedContent = selectedDaily?.content ?? "";
  if (
    syncedFrom.date !== selectedDate ||
    syncedFrom.content !== selectedContent
  ) {
    setSyncedFrom({ date: selectedDate, content: selectedContent });
    setDraft(selectedContent);
  }

  // Linkable candidates pool (DU-F Step 10): the visible dailies list.
  // Cross-role links still need raw id paste — DU-G unifies items_meta.
  const linkableItems = useMemo(
    () =>
      dailies.map((d) => ({
        id: d.id,
        label: `[daily] ${d.date}`,
      })),
    [dailies],
  );
  const resolveTitle = (id: string): string | undefined => {
    const d = dailies.find((dd) => dd.id === id);
    return d ? `[daily] ${d.date}` : undefined;
  };

  useEffect(() => {
    void loadDeletedDailies();
  }, [loadDeletedDailies]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label
          htmlFor="daily-date"
          className="text-sm text-notion-text-secondary"
        >
          Date
        </label>
        <input
          id="daily-date"
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="rounded-md border border-notion-border bg-notion-bg px-2 py-1 text-sm text-notion-text"
        />
        <button
          type="button"
          onClick={() => setSelectedDate(isoDay(0))}
          className="rounded-md border border-notion-border px-2 py-1 text-sm text-notion-text hover:bg-notion-hover"
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => setSelectedDate(isoDay(-1))}
          className="rounded-md border border-notion-border px-2 py-1 text-sm text-notion-text hover:bg-notion-hover"
        >
          Yesterday
        </button>
      </div>

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => upsertDaily(selectedDate, draft)}
        rows={8}
        placeholder="Write the day… (saved on blur — plain text; rich editor is S3)"
        className="w-full resize-y rounded-md border border-notion-border bg-notion-bg p-3 text-sm text-notion-text"
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => upsertDaily(selectedDate, draft)}
          className="rounded-md border border-notion-border px-3 py-1.5 text-sm text-notion-text hover:bg-notion-hover"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => togglePin(selectedDate)}
          className="rounded-md border border-notion-border px-3 py-1.5 text-sm text-notion-text hover:bg-notion-hover"
        >
          {selectedDaily?.isPinned ? "Unpin" : "Pin"}
        </button>
        <button
          type="button"
          onClick={() => deleteDaily(selectedDate)}
          className="rounded-md border border-notion-border px-3 py-1.5 text-sm text-notion-text hover:bg-notion-hover"
        >
          Delete
        </button>
      </div>

      {selectedDaily ? (
        <div className="space-y-2 rounded-md border border-notion-border p-2">
          <div className="flex flex-wrap items-center gap-2">
            <TagPicker itemId={selectedDaily.id} showLabel size="sm" />
          </div>
          <LinkPanel
            itemId={selectedDaily.id}
            resolveTitle={resolveTitle}
            linkableItems={linkableItems}
          />
        </div>
      ) : (
        <p className="text-xs text-notion-text-secondary">
          Save the daily first to add tags or links.
        </p>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-notion-text">
          Dailies ({dailies.length})
        </h2>
        <ul className="space-y-1">
          {dailies.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => setSelectedDate(d.date)}
                className={`w-full rounded-md px-2 py-1 text-left text-sm hover:bg-notion-hover ${
                  d.date === selectedDate
                    ? "bg-notion-hover text-notion-text"
                    : "text-notion-text-secondary"
                }`}
              >
                {d.isPinned ? "★ " : ""}
                {d.date}
                {d.hasPassword ? " 🔒" : ""}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {deletedDailies.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-notion-text">
            Trash ({deletedDailies.length})
          </h2>
          <ul className="space-y-1">
            {deletedDailies.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between text-sm text-notion-text-secondary"
              >
                <span>{d.date}</span>
                <button
                  type="button"
                  onClick={() => restoreDaily(d.date)}
                  className="rounded-md border border-notion-border px-2 py-0.5 text-xs text-notion-text hover:bg-notion-hover"
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
