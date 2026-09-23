import { useId, useRef, useState } from "react";
import type { RefObject } from "react";
import { ChevronDown, ChevronRight, MoreHorizontal, Plus } from "lucide-react";
import { Button } from "../Button";
import { cn } from "../cn";
import { SkeletonList } from "../SkeletonList";
import { TagHeadingIcon } from "../TagHeadingIcon";
import { SidebarFilterField } from "../materials/SidebarFilterField";
import { CARD_BTN_TAP, FOCUS_RING_TIGHT } from "../styleTokens";
import { isImeComposing } from "../../utils/imeGuard";
import { Palette, Pencil, Shapes, Trash2 } from "lucide-react";
import { TagActionsMenu, useTagActionsMenu } from "./TagActionsMenu";
import { TagHubActionSheet } from "./TagHubActionSheet";
import type { TagHubEditField } from "./TagHubEditBlock";
import type { TagHubLabels, TagHubTagSummary } from "./types";

/*
 * The hub's master column (#1171, made editable in #1643): a filter, the tag
 * list, and — since the tag edit modal was retired into this screen — the two
 * things that used to be the modal's reason to exist: a per-row "…" of tag
 * actions and a pinned row that creates one.
 *
 * WHAT THE LIST IS, top to bottom (D3–D5):
 *   1. the tags holding something, by name
 *   2. a rule, then the UNTAGGED bucket — a pseudo-tag, so it gets the default
 *      glyph, no tint and no "…" (there is nothing about it to rename)
 *   3. a disclosure over the tags nothing is filed under, collapsed by default
 *   4. pinned to the bottom edge, the add row
 *
 * The rule under (1) is what stops the bucket reading as a tag someone actually
 * named "Untagged"; the disclosure at (3) is what stops a tag made and never
 * used from sitting between two working topics (see the model's note).
 *
 * On narrow the same four actions come up as a BOTTOM SHEET instead (#1646 /
 * M1): a dropdown anchored to the right edge of a 390px screen opens over the
 * row it belongs to, and its rows are a thumb-stretch from where the thumb is.
 * Merging is not offered there — the brief keeps that irreversible tidy-up to
 * Desktop.
 *
 * The "…" menu also opens on a right-click anywhere on the row (#1676), at the
 * pointer — Desktop only, since narrow already shows the "…" at full size and a
 * long-press there belongs to the platform. A row with no menu (the untagged
 * bucket) leaves the browser's own context menu alone.
 *
 * The row is a BUTTON beside a button, not a button inside one: the "…" has to
 * be reachable on its own, and nesting it would be invalid HTML that browsers
 * resolve by dropping it. The selection bar and the tinted ground are painted
 * on the wrapper so they span both.
 *
 * Pure presentation: copy is injected (§6.4), lumen-* tokens only, opaque
 * surfaces (§5).
 */

export interface TagHubTagRailProps {
  /** Every tag holding something, untagged last — rendered in model order. */
  tags: readonly TagHubTagSummary[];
  /** The subset surviving the filter, in the same order. */
  visibleTags: readonly TagHubTagSummary[];
  /** Live tags with nothing filed under them, behind the disclosure (D4). */
  unusedTags: readonly TagHubTagSummary[];
  selectedId: string | null;
  onSelect: (tagId: string) => void;
  query: string;
  onQueryChange: (query: string) => void;
  /** Count → its accessible text ("3 items"), so the number is announced. */
  formatCount: (count: number) => string;
  /** Unused count → the disclosure's label ("Unused tags (3)"). */
  formatUnusedTags: (count: number) => string;
  /** Row menu → open the edit block on that field (D2). Omit to hide the "…". */
  onEditTag?: (tagId: string, field: TagHubEditField) => void;
  /** Row menu → the destructive item. Required whenever `onEditTag` is given. */
  onDeleteTag?: (tagId: string) => void;
  /** Row menu → merge this tag into another (#1644). Omit to hide the item. */
  onMergeTag?: (tagId: string) => void;
  /**
   * The pinned add row (D5). Omit to leave the row out. Return the write's
   * promise and a failure keeps the typed name and says so (#1847).
   */
  onCreateTag?: (name: string) => void | Promise<unknown>;
  /** The view's handle on the add field, for the empty state's CTA (D15). */
  addFieldRef?: RefObject<HTMLInputElement | null>;
  /** Wide = a fixed rail beside the items; narrow = the whole screen. */
  wide: boolean;
  /** True until the host's first reads land — draws the skeleton rows (D16). */
  isLoading?: boolean;
  labels: TagHubLabels;
}

export function TagHubTagRail({
  tags,
  visibleTags,
  unusedTags,
  selectedId,
  onSelect,
  query,
  onQueryChange,
  formatCount,
  formatUnusedTags,
  onEditTag,
  onDeleteTag,
  onMergeTag,
  onCreateTag,
  addFieldRef,
  wide,
  isLoading = false,
  labels,
}: TagHubTagRailProps) {
  // Collapsed by default: these are the tags you are NOT reading (D4).
  const [showUnused, setShowUnused] = useState(false);
  const [draft, setDraft] = useState("");
  /*
   * Why the add row did not create anything (#1847). A name that is already a
   * tag's is caught here, before sending — the unique constraint would answer
   * with a 409 — compared trimmed and case-insensitively, the same rule as the
   * selection bar's chooser. A write that comes back failed says so too. Both
   * keep the typed name; typing again clears the message.
   */
  const [addError, setAddError] = useState<string | null>(null);
  const addErrorId = useId();

  const submitDraft = () => {
    const name = draft.trim();
    if (!name || !onCreateTag) return;
    const needle = name.toLowerCase();
    const taken = [...tags, ...unusedTags].some(
      (tag) => !tag.isUntagged && tag.name.trim().toLowerCase() === needle,
    );
    if (taken) {
      setAddError(labels.duplicateName);
      return;
    }
    setAddError(null);
    const created = () => {
      setDraft("");
      // Clear the filter too: a tag created while a non-matching query is
      // active would land outside the visible list, so the rail would look
      // exactly as it did before (#368 QA).
      onQueryChange("");
    };
    const result = onCreateTag(name);
    if (result instanceof Promise) {
      result.then(created, () => setAddError(labels.createFailed));
    } else {
      created();
    }
  };

  const renderRow = (tag: TagHubTagSummary) => (
    <TagHubRailRow
      key={tag.id}
      tag={tag}
      active={tag.id === selectedId}
      onSelect={onSelect}
      formatCount={formatCount}
      onEditTag={onEditTag}
      onDeleteTag={onDeleteTag}
      onMergeTag={onMergeTag}
      wide={wide}
      labels={labels}
    />
  );

  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-col",
        wide ? "w-[260px] shrink-0 border-r border-lumen-border" : "flex-1",
      )}
    >
      {/* Hidden while there is nothing to narrow — an empty hub should show
          its "no tags yet" copy, not a search box (same rule as #368). */}
      {!isLoading && tags.length > 0 && (
        <div className="flex-shrink-0 border-b border-lumen-border px-3 py-2.5">
          <SidebarFilterField
            value={query}
            onChange={onQueryChange}
            placeholder={labels.filterPlaceholder}
            ariaLabel={labels.filterLabel}
            size="sm"
            // #1561 — the 44px touch floor on narrow. The "sm" preset is a
            // fixed `h-8`; `min-h-*` is a different property so it wins
            // outright, and the field's own `items-center` re-centres the
            // input in the taller box. The box is a <label> (#1578), so a tap
            // on the extra padding still focuses the input rather than only
            // painting a taller frame. Keyed on the `wide` prop rather than a
            // `max-md:` prefix because this component already knows which
            // layout it is in, and the prop is the shell's own breakpoint.
            className={cn(!wide && "min-h-11")}
          />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {isLoading ? (
          // The bars are decorative (SkeletonList is aria-hidden), so the wait
          // is announced by the frame around them instead (D16 / M7).
          <div aria-busy="true" aria-label={labels.loading} role="status">
            <SkeletonList rows={6} rowHeight={38} gap={2} />
          </div>
        ) : tags.length === 0 && unusedTags.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-lumen-text-tertiary">
            {labels.empty}
          </p>
        ) : visibleTags.length === 0 && unusedTags.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-lumen-text-tertiary">
            {labels.filterEmpty}
          </p>
        ) : (
          <>
            <ul aria-label={labels.listLabel} className="flex flex-col gap-0.5">
              {visibleTags.map(renderRow)}
            </ul>

            {unusedTags.length > 0 && (
              <div className="mt-1 border-t border-lumen-border pt-1.5">
                <button
                  type="button"
                  onClick={() => setShowUnused((v) => !v)}
                  aria-expanded={showUnused}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lumen-md px-2 py-1.5 text-left text-xs text-lumen-text-tertiary",
                    "transition-colors hover:bg-lumen-hover hover:text-lumen-text-secondary",
                    FOCUS_RING_TIGHT,
                    !wide && "min-h-11",
                  )}
                >
                  {showUnused ? (
                    <ChevronDown size={14} aria-hidden className="shrink-0" />
                  ) : (
                    <ChevronRight size={14} aria-hidden className="shrink-0" />
                  )}
                  <span className="min-w-0 flex-1 truncate">
                    {formatUnusedTags(unusedTags.length)}
                  </span>
                </button>
                {showUnused && (
                  <ul
                    aria-label={labels.unusedTagsHeading}
                    className="flex flex-col gap-0.5"
                  >
                    {unusedTags.map(renderRow)}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* The creation row, pinned to the bottom edge (D5). It used to live at
          the top of the retired modal; down here it is out of the way of the
          list that is read far more often than it is added to. */}
      {onCreateTag && (
        <div className="flex flex-shrink-0 flex-col gap-1.5 border-t border-lumen-border px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Plus
              size={16}
              aria-hidden
              className="shrink-0 text-lumen-text-tertiary"
            />
            <input
              ref={addFieldRef}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setAddError(null);
              }}
              aria-invalid={addError ? true : undefined}
              aria-describedby={addError ? addErrorId : undefined}
              onKeyDown={(e) => {
                // Never commit mid-IME-composition (§frontend gotcha).
                if (isImeComposing(e)) return;
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitDraft();
                }
              }}
              placeholder={labels.addPlaceholder}
              aria-label={labels.addPlaceholder}
              className={cn(
                "min-w-0 flex-1 rounded-lumen-md border border-lumen-border-strong bg-lumen-bg px-2.5 py-1.5 text-sm text-lumen-text",
                "placeholder:text-lumen-text-tertiary",
                FOCUS_RING_TIGHT,
                !wide && "min-h-11",
              )}
            />
            <Button
              variant="secondary"
              size="sm"
              className={CARD_BTN_TAP}
              onClick={submitDraft}
              disabled={!draft.trim()}
            >
              {labels.addButton}
            </Button>
          </div>
          {addError && (
            <p
              id={addErrorId}
              role="alert"
              className="text-xs text-lumen-danger"
            >
              {addError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface TagHubRailRowProps {
  tag: TagHubTagSummary;
  active: boolean;
  onSelect: (tagId: string) => void;
  formatCount: (count: number) => string;
  onEditTag?: (tagId: string, field: TagHubEditField) => void;
  onDeleteTag?: (tagId: string) => void;
  onMergeTag?: (tagId: string) => void;
  wide: boolean;
  labels: TagHubLabels;
}

function TagHubRailRow({
  tag,
  active,
  onSelect,
  formatCount,
  onEditTag,
  onDeleteTag,
  onMergeTag,
  wide,
  labels,
}: TagHubRailRowProps) {
  const menu = useTagActionsMenu();
  const menuAnchor = useRef<HTMLButtonElement | null>(null);
  const countText = formatCount(tag.count);
  // The untagged bucket is not a row of `wiki_tags`, so there is nothing to
  // rename, recolour or delete about it.
  const hasMenu = onEditTag != null && onDeleteTag != null && !tag.isUntagged;

  return (
    <li
      // Right-click opens the same menu as the "…" (#1676). Wide only, and only
      // where there is a menu: anywhere else the native menu is left intact.
      onContextMenu={hasMenu && wide ? menu.openAtPointer : undefined}
      className={cn(
        "group relative",
        // The rule above the untagged bucket. Applied to the <li> rather than
        // drawn as a separate element so the list stays one row per tag for a
        // screen reader.
        tag.isUntagged && "mt-1 border-t border-lumen-border pt-1.5",
      )}
    >
      {/* The selection bar (D3). On the wrapper rather than inside the row
          button so it spans the "…" too, and absolute so it does not shift the
          glyph by its own 2px when a row is picked. */}
      {active && (
        <span
          aria-hidden
          className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-lumen-accent"
        />
      )}
      <div
        className={cn(
          "flex items-center rounded-lumen-md transition-colors",
          active ? "bg-lumen-accent-subtle" : "hover:bg-lumen-hover",
        )}
      >
        <button
          type="button"
          onClick={() => onSelect(tag.id)}
          aria-current={active ? "true" : undefined}
          // Spelled out rather than left to the concatenated content, so the
          // count is announced with the name instead of as a loose number
          // after it.
          aria-label={`${tag.name}: ${countText}`}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 rounded-lumen-md px-2 py-1.5 text-left",
            FOCUS_RING_TIGHT,
            // #1561 — 44px touch floor on narrow only; the Desktop rail keeps
            // its 37.5px mouse row.
            !wide && "min-h-11",
            "text-lumen-text",
          )}
        >
          <TagHeadingIcon icon={tag.icon} color={tag.color} />
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-sm",
              tag.isUntagged && "text-lumen-text-secondary",
            )}
          >
            {tag.name}
          </span>
          <span
            aria-hidden
            className="shrink-0 rounded-full bg-lumen-bg-secondary px-2 py-0.5 text-xs font-medium tabular-nums text-lumen-text-secondary"
          >
            {tag.count}
          </span>
        </button>

        {/* The slot is reserved whether or not the "…" is painted, so a row
            does not reflow under the pointer as it is hovered. */}
        <div className={cn("relative flex shrink-0", wide ? "w-7" : "w-11")}>
          {hasMenu && (
            <>
              <button
                ref={menuAnchor}
                type="button"
                onClick={menu.toggleFromTrigger}
                aria-haspopup="menu"
                aria-expanded={menu.open}
                aria-label={`${tag.name}: ${labels.rowMenu}`}
                className={cn(
                  "flex w-full items-center justify-center rounded-lumen-sm text-lumen-text-secondary",
                  "transition-colors hover:text-lumen-text",
                  FOCUS_RING_TIGHT,
                  wide
                    ? // Desktop reveals it on hover (D2). `focus-visible` keeps
                      // it reachable by keyboard, where there is no hover at
                      // all, and an open menu holds it up while the pointer is
                      // over the menu rather than the row.
                      cn(
                        "h-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                        menu.open && "opacity-100",
                      )
                    : // Narrow has no hover to reveal it with (M2).
                      "h-11",
                )}
              >
                <MoreHorizontal size={16} aria-hidden />
              </button>
              {!wide && (
                <TagHubActionSheet
                  open={menu.open}
                  onClose={menu.close}
                  title={`${tag.name}: ${labels.rowMenu}`}
                  closeLabel={labels.sheetClose}
                  actions={[
                    {
                      label: labels.renameTag,
                      icon: <Pencil size={16} />,
                      onSelect: () => onEditTag?.(tag.id, "name"),
                    },
                    {
                      label: labels.changeIcon,
                      icon: <Shapes size={16} />,
                      onSelect: () => onEditTag?.(tag.id, "icon"),
                    },
                    {
                      label: labels.changeColor,
                      icon: <Palette size={16} />,
                      onSelect: () => onEditTag?.(tag.id, "color"),
                    },
                    {
                      label: labels.deleteTag,
                      icon: <Trash2 size={16} />,
                      danger: true,
                      onSelect: () => onDeleteTag?.(tag.id),
                    },
                  ]}
                />
              )}
              {wide && (
                <TagActionsMenu
                  open={menu.open}
                  onClose={menu.close}
                  tagName={tag.name}
                  anchorRef={menuAnchor}
                  anchorPoint={menu.anchorPoint}
                  align="end"
                  onEdit={(field) => onEditTag?.(tag.id, field)}
                  onDelete={() => onDeleteTag?.(tag.id)}
                  onMerge={onMergeTag && (() => onMergeTag(tag.id))}
                  labels={labels}
                />
              )}
            </>
          )}
        </div>
      </div>
    </li>
  );
}
