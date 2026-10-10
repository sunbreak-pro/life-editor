import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Plus, Tag as TagIcon } from "lucide-react";
import { TagPill } from "./TagPill";
import { TagHeadingIcon } from "./TagHeadingIcon";
import { BottomSheet } from "./BottomSheet";
import { TAP_TARGET } from "./styleTokens";
import { cn } from "./cn";
import { isImeComposing } from "../utils/imeGuard";

/*
 * WorkTagSelector — the tag field next to the Work screen's link-target
 * selector (#1665). It picks the tags a FREE SESSION will carry: when the timer
 * runs with nothing linked, the Provider files the time as a "Free session"
 * Event once the session closes, and these tags go onto that Event.
 *
 * Why not the item-bound TagPicker (web/src/wikitag): that one writes an
 * assignment the moment a tag is chosen, against an item id that already
 * exists. Here the item does not exist yet — it is minted when the session
 * ends — so the selection is held as plain ids by the host and applied later.
 * The dropdown mirrors TagPicker's (search / existing candidates / "create")
 * so the two read as the same control.
 *
 * Pure primitive (§6.4): tags, selection and copy come from the host, and
 * creating a tag is a callback — nothing here reaches a DataService.
 *
 * `disabled` is the state when a link target IS chosen: no free session will be
 * created, so the tags would go nowhere. The field stays on screen (dimmed,
 * with the host's hint as its title) rather than vanishing, so the row does not
 * jump every time the user picks or clears a target.
 *
 * `sheet` is the narrow-screen shape (#1856). The popover hangs off the right
 * edge of a field that the mobile face CENTRES and draws near the bottom of
 * the screen, so at 390px it opened with its left edge off screen and its list
 * under the tab bar. Re-anchoring it would still leave a 288px panel fighting
 * a 390px viewport and the soft keyboard; a BottomSheet is what every other
 * picker on that face already uses (the work-target one sits right above).
 * The host decides, because the host knows the width: the primitive never
 * reads a media query. With `sheet` the trigger also takes the 44px floor
 * (rules/frontend.md: the floor goes on at the call site that is narrow-only).
 */

export interface WorkTagOption {
  id: string;
  name: string;
  color: string | null;
  icon?: string | null;
}

export interface WorkTagSelectorLabels {
  heading: string;
  add: string;
  addShort: string;
  search: string;
  create: (name: string) => string;
  remove: (name: string) => string;
  noCandidates: string;
  dialog: string;
  /** Shown as the field's description while `disabled`. */
  disabledHint: string;
  /**
   * Sheet shape only (#2054): the visible text of the full-width row — "add a
   * tag" while live, and the short reason while disabled. Fall back to
   * `addShort` / `disabledHint` when omitted.
   */
  addRow?: string;
  disabledRow?: string;
}

export interface WorkTagSelectorProps {
  tags: WorkTagOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /** Create a tag by name and resolve with it (the host writes it). */
  onCreate: (name: string) => Promise<WorkTagOption>;
  labels: WorkTagSelectorLabels;
  disabled?: boolean;
  /**
   * Present the picker as a BottomSheet instead of an anchored popover, and
   * give the trigger a 44px touch height (#1856). Pass it on the narrow face
   * only; the desktop field omits it and is unchanged.
   */
  sheet?: { closeLabel: string };
  className?: string;
}

export function WorkTagSelector({
  tags,
  selectedIds,
  onChange,
  onCreate,
  labels,
  disabled = false,
  sheet,
  className,
}: WorkTagSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rowTextId = useId();

  // A target picked while the dropdown is open hides it — derived rather than
  // reset in an effect, which would be a cascading render for a value the
  // render can simply read (react-hooks/set-state-in-effect).
  const dropdownOpen = open && !disabled;

  // Click-outside closes the dropdown (same self-contained listener TagPicker
  // uses — no global registry).
  // Not in sheet mode: the sheet is portalled to <body>, so every press
  // inside it is "outside" this container, and its backdrop already closes it.
  const popoverOpen = dropdownOpen && !sheet;
  useEffect(() => {
    if (!popoverOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [popoverOpen]);

  const tagsById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selected = selectedIds
    .map((id) => tagsById.get(id))
    .filter((t): t is WorkTagOption => t !== undefined);

  const trimmed = query.trim();
  const candidates = useMemo(() => {
    const q = trimmed.toLowerCase();
    return tags
      .filter((t) => !selectedSet.has(t.id))
      .filter((t) => (q ? t.name.toLowerCase().includes(q) : true))
      .slice(0, 8);
  }, [tags, selectedSet, trimmed]);
  const exactMatch = trimmed
    ? (tags.find((t) => t.name.toLowerCase() === trimmed.toLowerCase()) ?? null)
    : null;

  const add = (id: string) => {
    if (!selectedSet.has(id)) onChange([...selectedIds, id]);
    setQuery("");
  };

  const createAndAdd = async () => {
    if (!trimmed) return;
    try {
      const tag = await onCreate(trimmed);
      onChange([...selectedIds, tag.id]);
      setQuery("");
    } catch (err) {
      console.error("[WorkTagSelector] creating a tag failed", err);
    }
  };

  const picker = (
    <>
      <input
        type="text"
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !isImeComposing(e)) {
            e.preventDefault();
            if (exactMatch) add(exactMatch.id);
            else void createAndAdd();
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={labels.search}
        className={cn(
          "w-full rounded-md border border-lumen-border bg-lumen-bg-secondary px-2 text-lumen-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lumen-accent",
          // 16px on the sheet: iOS zooms the page into any smaller input.
          sheet ? "min-h-11 text-base" : "py-1 text-sm",
        )}
      />
      <ul
        className={cn(
          "mt-2 space-y-0.5 overflow-y-auto",
          sheet ? "max-h-[50dvh]" : "max-h-48",
        )}
      >
        {candidates.length === 0 && !trimmed && (
          <li className="px-2 py-1 text-xs text-lumen-text-secondary">
            {labels.noCandidates}
          </li>
        )}
        {candidates.map((tag) => (
          <li key={tag.id}>
            <button
              type="button"
              onClick={() => add(tag.id)}
              className={cn(
                "flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm text-lumen-text hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lumen-accent",
                sheet && "min-h-11",
              )}
            >
              <TagHeadingIcon
                icon={tag.icon ?? null}
                color={tag.color}
                size={14}
              />
              <span>{tag.name}</span>
            </button>
          </li>
        ))}
        {trimmed && !exactMatch && (
          <li>
            <button
              type="button"
              onClick={() => void createAndAdd()}
              className={cn(
                "flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm text-lumen-accent hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lumen-accent",
                sheet && "min-h-11",
              )}
            >
              <Plus size={14} aria-hidden="true" />
              <span>{labels.create(trimmed)}</span>
            </button>
          </li>
        )}
      </ul>
    </>
  );

  const sheetPanel = sheet ? (
    <BottomSheet
      open={dropdownOpen}
      onClose={() => setOpen(false)}
      title={labels.dialog}
      closeLabel={sheet.closeLabel}
    >
      {picker}
    </BottomSheet>
  ) : null;

  /*
   * The sheet shape is a full-width 44px row since #2054 (Claude Design plan A
   * for the Mobile Work face): a sunken strip with the tag glyph, the chosen
   * pills, and an "add" button that takes the rest of the row so a tap almost
   * anywhere on it opens the sheet. Disabled, the strip turns into a dashed
   * outline and the button says WHY in words — the old dimmed field left the
   * reason in a `title` tooltip, which a phone never shows.
   */
  if (sheet) {
    return (
      <div
        ref={containerRef}
        data-testid="work-tag-selector"
        aria-disabled={disabled || undefined}
        className={cn(
          "flex min-h-11 w-full flex-wrap items-center gap-2 rounded-lumen-lg px-3 text-lumen-text-tertiary",
          disabled
            ? "border border-dashed border-lumen-border"
            : "bg-lumen-surface-sunken",
          className,
        )}
      >
        <TagIcon aria-hidden="true" className="size-lumen-icon-sm shrink-0" />
        {!disabled &&
          selected.map((tag) => (
            <TagPill
              key={tag.id}
              name={tag.name}
              color={tag.color}
              icon={tag.icon ?? null}
              removeLabel={labels.remove(tag.name)}
              onRemove={() =>
                onChange(selectedIds.filter((id) => id !== tag.id))
              }
              touch
            />
          ))}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          // Live, the visible text IS the name when the host gives one, so a
          // voice command that reads the row out ("タグを追加") hits it
          // (WCAG 2.5.3). Disabled, the visible text is the reason: the name
          // stays the action and the reason is read as the description.
          aria-label={labels.addRow && !disabled ? undefined : labels.add}
          aria-describedby={disabled ? rowTextId : undefined}
          aria-expanded={dropdownOpen}
          className={cn(
            // min-w-24, not min-w-0: with a zero floor the button never wraps
            // and is squeezed to nothing once three or four pills fill the
            // line. With a floor it drops to the next line instead.
            "flex min-h-11 min-w-24 flex-1 items-center text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lumen-accent",
            disabled ? "cursor-not-allowed text-xs" : "text-sm",
          )}
        >
          <span id={rowTextId}>
            {disabled
              ? (labels.disabledRow ?? labels.disabledHint)
              : (labels.addRow ?? labels.addShort)}
          </span>
        </button>
        {sheetPanel}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-testid="work-tag-selector"
      aria-disabled={disabled || undefined}
      title={disabled ? labels.disabledHint : undefined}
      className={cn(
        "relative inline-flex flex-wrap items-center gap-1",
        disabled && "opacity-55",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1 text-xs text-lumen-text-secondary">
        <TagIcon size={14} aria-hidden="true" />
        {labels.heading}
      </span>
      {selected.map((tag) => (
        <TagPill
          key={tag.id}
          name={tag.name}
          color={tag.color}
          icon={tag.icon ?? null}
          removeLabel={labels.remove(tag.name)}
          onRemove={
            disabled
              ? undefined
              : () => onChange(selectedIds.filter((id) => id !== tag.id))
          }
        />
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-label={labels.add}
        aria-expanded={dropdownOpen}
        className={cn(
          TAP_TARGET,
          "gap-1 rounded-md border border-dashed border-lumen-border px-2 py-1 text-xs text-lumen-text-secondary hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lumen-accent",
          disabled && "cursor-not-allowed hover:bg-transparent",
        )}
      >
        <Plus size={14} aria-hidden="true" />
        {selected.length === 0 && <span>{labels.addShort}</span>}
      </button>
      {disabled && <span className="sr-only">{labels.disabledHint}</span>}

      {dropdownOpen && (
        <div
          role="dialog"
          aria-label={labels.dialog}
          className="absolute right-0 top-full z-20 mt-1 w-64 max-w-[calc(100vw-2rem)] rounded-md border border-lumen-border bg-lumen-bg p-2 shadow-lg"
        >
          {picker}
        </div>
      )}
    </div>
  );
}
