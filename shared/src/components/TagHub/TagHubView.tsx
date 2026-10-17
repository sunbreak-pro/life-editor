import { useRef } from "react";
import type { ReactNode } from "react";
import { ChevronLeft, Pencil, Tags } from "lucide-react";
import { Button } from "../Button";
import { cn } from "../cn";
import { CARD_BTN_TAP } from "../styleTokens";
import { EmptyState } from "../EmptyState";
import { IconButton } from "../IconButton";
import { SkeletonList } from "../SkeletonList";
import { TagHeadingIcon } from "../TagHeadingIcon";
import { TagHubEditBlock } from "./TagHubEditBlock";
import { TagHubItemGroups } from "./TagHubItemGroups";
import { TagHubTagRail } from "./TagHubTagRail";
import { NO_EDITS, type TagRowEdits } from "./tagRowPatch";
import { UNTAGGED_TAG_ID } from "./types";
import type { TagHubItem, TagHubLabels, TagHubModel } from "./types";
import type { TodoStatus } from "../../types/todoTree";

/*
 * The Connect section's body (#1171) — a tag hub, the Wikipedia category page
 * for your own records: pick a topic on the left, read everything filed under
 * it on the right, grouped by kind.
 *
 * It replaces the force-directed graph #1152 retired. The graph drew every
 * relationship at once and left you to find the one you meant; this asks for
 * the topic first and then shows only its rows, which is the reading the
 * author actually wanted out of it ("this topic's total, and what moved
 * lately").
 *
 * #1643 made it the place tags are EDITED too (D-20260912-main-1 Q1-A). The
 * retired tag edit modal listed the very same tags in deliberately the same row
 * shape and was the only one of the two that could change them; folding it in
 * means one tag master instead of two views that have to be kept looking alike.
 * What that adds here is small and all optional: the rail's "…" and add row,
 * and the editor block between this header and the items — hand none of the
 * edit callbacks and the hub is exactly the read-only surface it was.
 *
 * LAYOUT. Wide is master + detail side by side. Narrow is the same two panes
 * one at a time — the tag list, then the items with a back arrow — rather than
 * a squeezed rail, because a 260px column and a list of titles do not both fit
 * on a phone. `wide` is passed in, not measured here: the host owns the media
 * query (§6.4) and jsdom has no layout to measure anyway (CLAUDE.md §7.1).
 *
 * Pure presentation. The state (which tag, what filter text, the drafts) is the
 * host's, data and copy are injected, and nothing here reaches a DataService
 * (§3.1).
 */

export interface TagHubViewProps {
  model: TagHubModel;
  /** The selected tag id — null on narrow means "showing the tag list". */
  selectedTagId: string | null;
  onSelectTag: (tagId: string | null) => void;
  query: string;
  onQueryChange: (query: string) => void;
  /** Row click — the host routes it to the shell's item-nav. */
  onOpenItem: (item: TagHubItem) => void;
  /** Count → its accessible text ("3 items"). */
  formatCount: (count: number) => string;
  /** Unused count → the rail disclosure's label ("Unused tags (3)"). */
  formatUnusedTags: (count: number) => string;
  /** Wide layout (master + detail) vs. narrow (one pane at a time). */
  wide: boolean;
  /** True until the host's first reads land, so an empty hub cannot flash. */
  isLoading: boolean;
  labels: TagHubLabels;

  /*
   * The editing half (#1643). All optional and all or nothing in practice: a
   * host that passes none gets the pre-#1643 read-only hub, which is what keeps
   * this component usable from a surface that has no tag writes to offer.
   */
  /** Whether the edit block is open for the selected tag. */
  editOpen?: boolean;
  /** The pencil (D6) and the rail's "…" both toggle it through here. */
  onToggleEdit?: () => void;
  /** Rail "…" → "Edit tag": open the block on that tag (D2 / #1886). */
  onEditTag?: (tagId: string) => void;
  /** Put the caret in the block's name field; consumed once by the host. */
  editFocusName?: boolean;
  /** The selected tag's unsaved draft (#715). */
  edits?: TagRowEdits;
  /** Whether that draft amounts to something the save button would write. */
  editDirty?: boolean;
  onEditChange?: (patch: TagRowEdits) => void;
  onEditDrop?: (field: keyof TagRowEdits) => void;
  onEditSave?: () => void;
  /** Why the selected tag's last save did not land, translated (#1847). */
  editError?: string | null;
  /** Delete the tag — the host confirms first (it owns the dialog layer). */
  onDeleteTag?: (tagId: string) => void;
  /**
   * The rail's pinned add row, and the empty state's primary action (D5/D15).
   * Return the write's promise so a failure can be shown under the row (#1847).
   */
  onCreateTag?: (name: string) => void | Promise<unknown>;

  /*
   * Bulk selection (#1644 / #2224). The host owns which rows are checked,
   * whether selection mode is on, and draws the bar (it holds the writes).
   * The view draws the header's "Select" button, shows the squares only in
   * selection mode, and places the bar: in the tag rail above the add row on
   * wide (so the items pane never shifts), pinned over the list's bottom
   * edge on narrow.
   */
  selecting?: boolean;
  /** The header's "Select" / "Done selecting" button. Omit to hide it. */
  onToggleSelecting?: () => void;
  checkedItemIds?: ReadonlySet<string>;
  onToggleItemChecked?: (itemId: string) => void;
  formatSelectItem?: (title: string) => string;

  /*
   * Relations selection (#1645): which item the right panel is showing, and
   * what a row's click does. The host passes none of it on narrow.
   */
  activeItemId?: string | null;
  onSelectItem?: (item: TagHubItem) => void;
  formatOpenItem?: (title: string) => string;
  /** The narrow row's "…" (#1646 / M3) and that button's name. */
  onItemMenu?: (item: TagHubItem) => void;
  formatItemMenu?: (title: string) => string;
  /** The bulk bar, placed by the view while a tag is open (see above). */
  selectionBar?: ReactNode;
  /** A row's day key → its bold left-edge day (#2224). */
  formatDay?: (dayKey: string) => string;
  /** A todo row's round checkbox (#2224). */
  onToggleTodoStatus?: (item: TagHubItem, next: TodoStatus) => void;
  /** Right-click / long press on a row (#2224). */
  onItemContextMenu?: (item: TagHubItem) => void;
}

export function TagHubView({
  model,
  selectedTagId,
  onSelectTag,
  query,
  onQueryChange,
  onOpenItem,
  formatCount,
  formatUnusedTags,
  wide,
  isLoading,
  labels,
  editOpen = false,
  onToggleEdit,
  onEditTag,
  editFocusName = false,
  edits = NO_EDITS,
  editDirty = false,
  onEditChange,
  onEditDrop,
  onEditSave,
  editError = null,
  onDeleteTag,
  onCreateTag,
  selecting = false,
  onToggleSelecting,
  checkedItemIds,
  onToggleItemChecked,
  formatSelectItem,
  activeItemId,
  onSelectItem,
  formatOpenItem,
  onItemMenu,
  formatItemMenu,
  selectionBar,
  formatDay,
  onToggleTodoStatus,
  onItemContextMenu,
}: TagHubViewProps) {
  /*
   * The empty state's "add a tag" button and the rail's add FIELD are the same
   * affordance seen from two panes (D15 / D5), so the button moves the caret
   * into the field rather than opening a second way to type a name. A ref
   * rather than a callback prop: both ends are inside this component, and the
   * host has no part in where focus lands.
   */
  const addFieldRef = useRef<HTMLInputElement | null>(null);

  const trimmed = query.trim().toLowerCase();
  const visibleTags = trimmed
    ? model.tags.filter((tag) => tag.name.toLowerCase().includes(trimmed))
    : model.tags;

  /*
   * Resolved across BOTH runs (#1643). A tag the rail files under "unused" is
   * still selectable — editing or deleting one is the whole reason to open that
   * disclosure — so looking it up in `model.tags` alone would leave the pane
   * saying "pick a tag" while the row it was opened from sits highlighted.
   */
  const selected = selectedTagId
    ? ([...model.tags, ...model.unusedTags].find(
        (tag) => tag.id === selectedTagId,
      ) ?? null)
    : null;
  const groups = selected ? (model.groupsByTag.get(selected.id) ?? []) : [];
  // The untagged bucket is not a `wiki_tags` row, so there is nothing about it
  // to edit — the pencil stays out rather than opening a block over a fiction.
  const editable =
    selected !== null &&
    selected.id !== UNTAGGED_TAG_ID &&
    onToggleEdit != null &&
    onEditChange != null;

  const rail = (
    <TagHubTagRail
      tags={model.tags}
      visibleTags={visibleTags}
      unusedTags={model.unusedTags}
      selectedId={selectedTagId}
      onSelect={onSelectTag}
      query={query}
      onQueryChange={onQueryChange}
      formatCount={formatCount}
      formatUnusedTags={formatUnusedTags}
      onEditTag={onEditTag}
      onDeleteTag={onDeleteTag}
      onCreateTag={onCreateTag}
      addFieldRef={addFieldRef}
      wide={wide}
      isLoading={isLoading}
      labels={labels}
      // #2224 — the Desktop bulk bar sits here, above the add row.
      footer={wide && selected ? selectionBar : undefined}
    />
  );

  // Narrow shows one pane at a time, and the tag list IS the landing pane —
  // so nothing is selected until the user picks, and the back arrow clears the
  // selection to return. Wide has no such mode: both panes are always up.
  if (!wide && (isLoading || selected === null)) {
    return <div className="flex h-full min-h-0 flex-col">{rail}</div>;
  }

  const detail = (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      {selected && (
        <div className="flex flex-shrink-0 items-center gap-2 border-b border-lumen-border px-3 py-2.5">
          {!wide && (
            <IconButton
              icon={<ChevronLeft size={18} />}
              label={labels.back}
              variant="ghost"
              size="md"
              // #1561 — this branch draws ONLY on narrow, so the 44px floor is
              // unconditional (same shape as the drawer's close button in
              // #1556). Both axes: the audit read 36×36. The box grows rather
              // than a `::after` because the heading icon sits flush beside it
              // and a pseudo-element would overlap it.
              className="min-h-11 min-w-11"
              onClick={() => onSelectTag(null)}
            />
          )}
          <TagHeadingIcon icon={selected.icon} color={selected.color} />
          <h2
            className={cn(
              "min-w-0 flex-1 truncate text-sm font-semibold",
              selected.isUntagged
                ? "text-lumen-text-secondary"
                : "text-lumen-text",
            )}
          >
            {selected.name}
          </h2>
          <span className="shrink-0 text-xs tabular-nums text-lumen-text-tertiary">
            {formatCount(selected.count)}
          </span>
          {onToggleSelecting && groups.length > 0 && (
            // #2224 — the squares hide behind this. Ending the mode drops
            // whatever was checked (the host does that). The label says the
            // state ("Select" / "Done selecting"), so no aria-pressed on top.
            <Button
              variant={selecting ? "secondary" : "ghost"}
              size="sm"
              className={cn("shrink-0", CARD_BTN_TAP, !wide && "min-h-11")}
              onClick={onToggleSelecting}
            >
              {selecting ? labels.selectEnd : labels.select}
            </Button>
          )}
          {editable && (
            <IconButton
              icon={<Pencil size={15} />}
              label={labels.editTag}
              variant="ghost"
              size="sm"
              aria-expanded={editOpen}
              className={cn(
                "shrink-0",
                editOpen && "bg-lumen-accent-subtle text-lumen-accent",
                !wide && "min-h-11 min-w-11",
              )}
              onClick={onToggleEdit}
            />
          )}
        </div>
      )}
      <div
        data-taghub-items=""
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3",
          // Room under the last row for the pinned narrow bar (#2224), so the
          // bar covers padding rather than the row a thumb is reaching for.
          !wide && selected !== null && selectionBar != null && "pb-20",
        )}
      >
        {isLoading ? (
          <div aria-busy="true" aria-label={labels.loading} role="status">
            <SkeletonList rows={6} />
          </div>
        ) : selected === null ? (
          <EmptyState
            icon={<Tags />}
            message={
              model.tags.length === 0 && model.unusedTags.length === 0
                ? labels.empty
                : labels.selectHint
            }
            cta={
              // The empty hub's one way forward (D15). Offered only when there
              // is genuinely nothing — with tags on the rail, "pick one" is the
              // instruction, and a button would compete with it.
              model.tags.length === 0 &&
              model.unusedTags.length === 0 &&
              onCreateTag
                ? {
                    label: labels.emptyAction,
                    onClick: () => addFieldRef.current?.focus(),
                  }
                : undefined
            }
          />
        ) : (
          <>
            {editable && editOpen && (
              <TagHubEditBlock
                tag={selected}
                edits={edits}
                dirty={editDirty}
                focusName={editFocusName}
                onEdit={onEditChange}
                onDropEdit={(field) => onEditDrop?.(field)}
                onSave={() => onEditSave?.()}
                error={editError}
                onDelete={() => onDeleteTag?.(selected.id)}
                labels={labels.edit}
              />
            )}
            {groups.length === 0 ? (
              <EmptyState icon={<Tags />} message={labels.tagEmpty} />
            ) : (
              <TagHubItemGroups
                groups={groups}
                onOpenItem={onOpenItem}
                formatCount={formatCount}
                wide={wide}
                labels={labels}
                checkedIds={checkedItemIds}
                onToggleChecked={onToggleItemChecked}
                formatSelectItem={formatSelectItem}
                selecting={selecting}
                formatDay={formatDay}
                onToggleTodoStatus={onToggleTodoStatus}
                onItemContextMenu={onItemContextMenu}
                activeItemId={activeItemId}
                onSelectItem={onSelectItem}
                formatOpenItem={formatOpenItem}
                onItemMenu={onItemMenu}
                formatItemMenu={formatItemMenu}
              />
            )}
          </>
        )}
      </div>
      {!wide && selected && selectionBar && (
        // #2224 — pinned over the list's bottom edge rather than laid out
        // under it, so the rows above are not pushed up when it appears.
        <div className="absolute inset-x-0 bottom-0 z-10">{selectionBar}</div>
      )}
    </div>
  );

  if (!wide)
    return <div className="flex h-full min-h-0 flex-col">{detail}</div>;

  return (
    <div className="flex h-full min-h-0 w-full">
      {rail}
      {detail}
    </div>
  );
}
