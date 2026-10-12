import { useEffect, useId, useRef, useState } from "react";
import { Paperclip } from "lucide-react";
import { cn } from "../cn";
import { SegmentedToggle } from "../SegmentedToggle";
import { FOCUS_RING_TIGHT } from "../styleTokens";
import { isImeComposing } from "../../utils/imeGuard";
import type { ItemCreateNoteDraft, ItemCreateOption } from "./ItemCreatePanel";

/*
 * ItemNoteAttach (#2219) — "ノートを添付" for an item that already exists.
 *
 * The create panel stages a note and attaches it once the new row is saved
 * (#376 / #1370). The edit panels had no way in at all, so attaching a note to
 * an event made yesterday meant deleting and re-adding it. This is the same
 * choice — a new note by title, or one picked from the list — on a row that is
 * already there, so the attach happens on the press rather than waiting for a
 * save: the row exists, and the tag row it sits on writes on the press too.
 *
 * It sits at the right end of the tag row, folded into one button. The fields
 * open in a small panel under it, the way the TagPicker beside it opens its
 * list.
 *
 * Pure presentation (§3.1 / §6.4): the list and the write are the host's,
 * every word arrives translated. lumen-* tokens only; the panel is opaque (§5).
 */

export interface ItemNoteAttachLabels {
  /** The button — 「ノートを添付」. */
  attachNote: string;
  noteSourceLabel: string;
  noteSourceNew: string;
  noteSourceExisting: string;
  noteTitleLabel: string;
  notePlaceholder: string;
  searchNotes: string;
  notePickerEmpty: string;
  notePickerNoMatch: string;
  /** The panel's commit — 「添付」. */
  attach: string;
  /** Caption before the notes attached from this panel — 「添付したノート」. */
  attachedNote: string;
}

export interface ItemNoteAttachProps {
  /** The notes the "existing" side offers (the create panel's pool). */
  notes: ItemCreateOption[];
  /** Create-and-link or link. Fires once per press; the host owns the write. */
  onAttach: (draft: ItemCreateNoteDraft) => void;
  labels: ItemNoteAttachLabels;
  /**
   * The panel opened or closed — the host reads `notes` only while it is
   * open. Reported closed on unmount too, so a torn-down panel cannot keep
   * the host reading.
   */
  onOpenChange?: (open: boolean) => void;
}

const FIELD = cn(
  "w-full rounded-lumen-md border border-lumen-border bg-lumen-bg-secondary px-2 py-1 text-sm text-lumen-text",
  FOCUS_RING_TIGHT,
);

/** How many matches the list shows at once; the search narrows the rest. */
const LIST_LIMIT = 8;

export function ItemNoteAttach({
  notes,
  onAttach,
  labels,
  onOpenChange,
}: ItemNoteAttachProps) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<"new" | "existing">("new");
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const [pickedId, setPickedId] = useState<string | null>(null);
  // What this panel attached while it has been open — the row has no list of
  // linked notes of its own, so without it a press would leave no trace.
  const [attached, setAttached] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelId = useId();

  // A ref so the report never pins a stale callback, refreshed in an effect
  // as react-hooks/refs asks (the EventEditorPane `onDirtyChange` idiom).
  const onOpenChangeRef = useRef(onOpenChange);
  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  });
  useEffect(() => {
    onOpenChangeRef.current?.(open);
  }, [open]);
  useEffect(() => () => onOpenChangeRef.current?.(false), []);

  // Outside-press closes, like the TagPicker next to it.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const trimmed = title.trim();
  const picked = notes.find((n) => n.id === pickedId) ?? null;
  const canAttach = source === "new" ? trimmed.length > 0 : picked != null;

  const attach = () => {
    if (!canAttach) return;
    if (source === "new") {
      onAttach({ kind: "new", title: trimmed });
      setAttached((prev) => [...prev, trimmed]);
    } else if (picked) {
      onAttach({ kind: "existing", id: picked.id });
      setAttached((prev) => [...prev, picked.title]);
    }
    setTitle("");
    setQuery("");
    setPickedId(null);
    close();
  };

  const q = query.trim().toLowerCase();
  const matches = notes
    .filter((n) => !q || n.title.toLowerCase().includes(q))
    .slice(0, LIST_LIMIT);

  return (
    <div
      ref={containerRef}
      className="relative flex shrink-0 flex-col items-end gap-1"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open && !isImeComposing(e)) {
          // The panel closes, not the editor frame around it.
          e.stopPropagation();
          close();
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className={cn(
          "inline-flex items-center gap-1 rounded-lumen-md px-1.5 py-1 text-xs text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-text max-md:min-h-11",
          FOCUS_RING_TIGHT,
        )}
      >
        <Paperclip aria-hidden className="size-3.5 shrink-0" />
        {labels.attachNote}
      </button>
      {attached.length > 0 && (
        <p className="max-w-48 truncate text-xs text-lumen-text-secondary">
          {labels.attachedNote}: {attached.join("、")}
        </p>
      )}
      {open && (
        <div
          id={panelId}
          role="group"
          aria-label={labels.attachNote}
          className="absolute right-0 top-full z-20 mt-1 flex w-64 flex-col gap-2 rounded-lumen-md border border-lumen-border bg-lumen-bg p-2 shadow-lumen-lg"
        >
          <SegmentedToggle
            options={[
              { value: "new" as const, label: labels.noteSourceNew },
              { value: "existing" as const, label: labels.noteSourceExisting },
            ]}
            value={source}
            onChange={setSource}
            label={labels.noteSourceLabel}
          />
          {source === "new" ? (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isImeComposing(e)) {
                  e.preventDefault();
                  attach();
                }
              }}
              placeholder={labels.notePlaceholder}
              aria-label={labels.noteTitleLabel}
              className={FIELD}
              autoFocus
            />
          ) : (
            <div className="flex flex-col gap-1">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label={labels.searchNotes}
                placeholder={labels.searchNotes}
                className={FIELD}
              />
              {notes.length === 0 ? (
                <p className="px-1 text-xs text-lumen-text-secondary">
                  {labels.notePickerEmpty}
                </p>
              ) : matches.length === 0 ? (
                <p className="px-1 text-xs text-lumen-text-secondary">
                  {labels.notePickerNoMatch}
                </p>
              ) : (
                <ul
                  role="listbox"
                  aria-label={labels.searchNotes}
                  className="flex max-h-40 flex-col overflow-y-auto"
                >
                  {matches.map((n) => (
                    <li key={n.id} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={n.id === pickedId}
                        onClick={() => setPickedId(n.id)}
                        className={cn(
                          "w-full truncate rounded-lumen-md px-2 py-1 text-left text-sm text-lumen-text transition-colors hover:bg-lumen-hover",
                          n.id === pickedId && "bg-lumen-hover font-medium",
                          FOCUS_RING_TIGHT,
                        )}
                      >
                        {n.title}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={attach}
            disabled={!canAttach}
            className={cn(
              "self-end rounded-lumen-md bg-lumen-accent px-2.5 py-1 text-xs font-medium text-lumen-on-accent transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
              FOCUS_RING_TIGHT,
            )}
          >
            {labels.attach}
          </button>
        </div>
      )}
    </div>
  );
}
