import { useEffect, useId, useRef, useState } from "react";
import type { RefObject } from "react";
import { Plus } from "lucide-react";
import { cn } from "../cn";
import { TagHeadingIcon } from "../TagHeadingIcon";
import { FOCUS_RING_TIGHT } from "../styleTokens";
import { isImeComposing } from "../../utils/imeGuard";
import type { TagHubTagSummary } from "./types";

/*
 * The selection bar's tag chooser (#1644 / D11): a search field, the matching
 * tags, and — below a rule — a row that creates the typed name.
 *
 * The design never drew it open beyond the one frame in 2f, so the brief's
 * wording is the spec: "検索欄 + タグ行のリスト + 最下部に「「設計」を作成」".
 * The create row is offered only while the text names no existing tag
 * (case-insensitive), because creating a duplicate name hits the unique
 * constraint and the host's write would fail.
 *
 * A dialog, not a menu: it holds a text field, and a role=menu would take the
 * arrow keys away from the caret. Esc closes it (IME-guarded) and is stopped
 * there, so the selection bar's own Esc — clear the selection — does not also
 * fire and throw the checked rows away with the popover.
 *
 * NOT portalled: the caller wraps its trigger and this in a `relative` box and
 * the popover opens above it (the bar sits on the pane's bottom edge). Opaque
 * surface (§5), lumen-* tokens only, copy injected (§6.4).
 */

export interface TagHubTagPickerLabels {
  /** The field's placeholder and accessible name ("Search or create a tag…"). */
  search: string;
  /** "Create “{name}”" — a formatter, because the name sits inside the copy. */
  formatCreate: (name: string) => string;
  /** Shown when the search matches no tag and nothing can be created. */
  empty: string;
}

export interface TagHubTagPickerPopoverProps {
  open: boolean;
  onClose: () => void;
  /** The dialog's accessible name ("Add a tag"). */
  title: string;
  /** Every tag that may be picked, in display order. */
  tags: readonly TagHubTagSummary[];
  onPick: (tagId: string) => void;
  /** Omit to leave the create row out. */
  onCreate?: (name: string) => void;
  /** The trigger, so pressing it again closes rather than re-opens. */
  anchorRef?: RefObject<HTMLElement | null>;
  labels: TagHubTagPickerLabels;
}

export function TagHubTagPickerPopover({
  open,
  onClose,
  title,
  tags,
  onPick,
  onCreate,
  anchorRef,
  labels,
}: TagHubTagPickerPopoverProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const listId = useId();

  // Outside-press close, the same rule as Menu: the trigger counts as inside.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (anchorRef?.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("pointerdown", onPointer, true);
    return () => document.removeEventListener("pointerdown", onPointer, true);
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  const trimmed = query.trim();
  const needle = trimmed.toLowerCase();
  const matches = needle
    ? tags.filter((tag) => tag.name.toLowerCase().includes(needle))
    : tags;
  const exists = tags.some((tag) => tag.name.toLowerCase() === needle);
  const canCreate = onCreate != null && trimmed !== "" && !exists;

  const finish = (run: () => void) => {
    setQuery("");
    onClose();
    run();
  };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={title}
      onKeyDown={(e) => {
        if (isImeComposing(e)) return;
        if (e.key === "Escape") {
          e.stopPropagation();
          e.preventDefault();
          finish(() => {});
        }
      }}
      className={cn(
        "absolute bottom-full right-0 z-50 mb-2 flex w-64 flex-col",
        "rounded-lumen-md border border-lumen-border bg-lumen-bg shadow-lumen-lg",
      )}
    >
      <div className="border-b border-lumen-border p-2">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (isImeComposing(e)) return;
            if (e.key !== "Enter") return;
            e.preventDefault();
            // Enter takes the only match, or creates the typed name — the two
            // cases where what Enter means is not a guess.
            if (matches.length === 1) finish(() => onPick(matches[0].id));
            else if (canCreate) finish(() => onCreate?.(trimmed));
          }}
          placeholder={labels.search}
          aria-label={labels.search}
          aria-controls={listId}
          className={cn(
            "w-full rounded-lumen-md border border-lumen-border-strong bg-lumen-bg px-2.5 py-1.5 text-sm text-lumen-text",
            "placeholder:text-lumen-text-tertiary",
            FOCUS_RING_TIGHT,
          )}
        />
      </div>
      <ul id={listId} className="max-h-60 overflow-y-auto py-1">
        {matches.map((tag) => (
          <li key={tag.id}>
            <button
              type="button"
              onClick={() => finish(() => onPick(tag.id))}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-lumen-text",
                "transition-colors hover:bg-lumen-hover",
                FOCUS_RING_TIGHT,
              )}
            >
              <TagHeadingIcon icon={tag.icon} color={tag.color} />
              <span className="min-w-0 flex-1 truncate">{tag.name}</span>
            </button>
          </li>
        ))}
        {matches.length === 0 && !canCreate && (
          <li className="px-3 py-2 text-xs text-lumen-text-tertiary">
            {labels.empty}
          </li>
        )}
      </ul>
      {canCreate && (
        <div className="border-t border-lumen-border py-1">
          <button
            type="button"
            onClick={() => finish(() => onCreate?.(trimmed))}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-lumen-accent",
              "transition-colors hover:bg-lumen-hover",
              FOCUS_RING_TIGHT,
            )}
          >
            <Plus size={14} aria-hidden className="shrink-0" />
            <span className="min-w-0 flex-1 truncate">
              {labels.formatCreate(trimmed)}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
