import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Plus,
  Tag as TagIcon,
  Trash2,
  X,
} from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { ColorPicker } from "./ColorPicker";
import { cn } from "./cn";
import { resolveTagIcon, TAG_ICON_CHOICES } from "./tagIcon";
import { TagHeadingIcon } from "./TagHeadingIcon";
import { ItemRoleBadge } from "./items/ItemRoleBadge";
import { type ItemRoleLabels } from "./items/itemRole";
import { SidebarFilterField } from "./materials/SidebarFilterField";
import { isImeComposing } from "../utils/imeGuard";

/*
 * Tag edit modal (#310 part 2, globalized in #409). A props-injected (§6.4)
 * manager for wiki_tags: add / rename / delete a tag and change its icon +
 * color, plus (#409) an expandable per-tag list of the items carrying it with
 * a per-row unassign — the tag master and its memberships in one panel.
 *
 * #409 moved the entry point from the Notes sidebar to the app shell's left
 * sidebar, so this panel is now app-global: its item list spans every role,
 * and each row announces its kind through the shared <ItemRoleBadge> (the same
 * contract #412's item-side picker renders from — components/items/itemRole).
 *
 * #368 put a name filter above the list — this is the app's only view of the
 * tag master, so it grows with every tag ever made and scrolling was the only
 * way through it. Filter only, no sort: the host receives `allTags` already
 * name-ordered from the service query (D-20260728-main-3).
 *
 * SAVE BUTTON (#715, Epic #627 — ユーザー裁定 D-20260810-sched-1 = A). Editing
 * an EXISTING tag — its name, its icon, its color — is a draft, and nothing
 * reaches the host until that row's save button is pressed. Blur writes
 * nothing. Before this the name committed on blur while the two pickers wrote
 * on the click, so one panel confirmed edits two different ways and merely
 * tabbing out of the field renamed a tag — a rename that does not stop at this
 * screen, since a wiki tag is referenced from every item carrying it.
 *
 * The pending edits live HERE, not in the row, for one reason: the #368 filter
 * unmounts the rows it hides. Row-local drafts would be thrown away by typing
 * in the search box, silently, which is the exact loss the save button exists
 * to make impossible. Holding them by tag id also means the panel-wide dirty
 * flag (`onDirtyChange`) counts rows the filter is currently hiding.
 *
 * Each row's draft is an OVERLAY on the live tag (the #628 rule): only the
 * fields actually typed against are held, so a rename landing from Realtime or
 * MCP still reaches an untouched row instead of being reverted by a stale
 * draft the user never edited.
 *
 * NOT drafted, and deliberately so: Add, Delete and per-item unassign. Those
 * are acts rather than field edits — nothing about them is "half typed" — and
 * the add row is a creation form, which D-20260811-main-1 puts outside this
 * Epic.
 *
 * DataService is unknown here — every mutation is a callback, every string a
 * label, colors reuse the shared ColorPicker, and the icon picker resolves
 * lucide names via the shared `tagIcon` helper (also consumed by #311).
 * lumen-* tokens only; the Modal owns the opaque panel + backdrop + Esc/
 * focus-trap (IME-guarded).
 */

/** One item carrying a tag, as listed under its tag row (#409). */
export interface TagEditItem {
  /** wiki_tag_assignments.id — what `onUnassign` removes. */
  assignmentId: string;
  /** items_meta.id of the tagged item. */
  itemId: string;
  /** Raw `items_meta.role`; unknown values render the neutral fallback badge. */
  role: string;
  /** Already-resolved display title (host supplies an untitled fallback). */
  title: string;
}

export interface TagEditRow {
  id: string;
  name: string;
  color: string | null;
  /** lucide icon name, or null for the default icon. */
  icon: string | null;
  /** Active items carrying this tag (role-agnostic). */
  count: number;
  /**
   * The items behind `count`, listed when the row is expanded (#409). Omit to
   * keep the row count-only (no disclosure) — the pre-#409 behavior.
   */
  items?: readonly TagEditItem[];
}

export interface TagEditModalLabels {
  title: string;
  addPlaceholder: string;
  addButton: string;
  empty: string;
  /** #368 name filter: placeholder for the filter input. */
  filterPlaceholder: string;
  /** #368 name filter: aria-label for the filter input. */
  filterLabel: string;
  /** #368 name filter: copy shown when the query matches no tag. */
  filterEmpty: string;
  /** aria-label for the per-row name input. */
  renameLabel: string;
  /**
   * #715 save button: the only thing that commits a row's pending name / icon /
   * color. Shown on that row alone, and only while something is pending.
   */
  saveLabel: string;
  /** aria-label for the per-row delete button. */
  deleteLabel: string;
  /** Trigger + group label for the icon picker. */
  iconLabel: string;
  /** "Default / no icon" option in the icon picker. */
  clearIconLabel: string;
  /** ColorPicker labels. */
  colorLabel: string;
  colorClearLabel: string;
  colorCustomLabel: string;
  /** #409 item list: aria-label for the count pill that toggles the list. */
  itemsToggleLabel: string;
  /** #409 item list: copy shown when an expanded tag carries nothing. */
  itemsEmpty: string;
  /** #409 item list: aria-label for a row's "remove this tag" button. */
  unassignLabel: string;
  /** #409 item list: already-translated item-kind names for the role badge. */
  roles: ItemRoleLabels;
}

export interface TagEditModalProps {
  open: boolean;
  onClose: () => void;
  tags: readonly TagEditRow[];
  onCreate: (name: string) => void;
  /**
   * Rename a tag (#715: fires from that row's save button, never from a blur).
   * The name arrives trimmed and different from the stored one — a blank or
   * unchanged draft is not a rename, so the propagation the host does around
   * `renameTag` is reached exactly when it was before.
   */
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  /** Set a tag's color (#715: from the row's save button, not the swatch click). */
  onSetColor: (id: string, color: string | null) => void;
  /** Set a tag's icon (#715: from the row's save button, not the icon click). */
  onSetIcon: (id: string, icon: string | null) => void;
  /**
   * Remove one item↔tag assignment (#409). Required whenever any row supplies
   * `items`; rows without `items` never expand, so it is never called.
   */
  onUnassign?: (assignmentId: string) => void;
  /**
   * Report whether ANY row is holding unsaved edits (#715, mirroring #628's
   * `onDirtyChange`). The host owns the close affordances — Esc, the backdrop,
   * whatever opened the panel — so it is the only place that can ask "discard?"
   * before one of them throws the drafts away. Fires with `false` on unmount so
   * a host parking this in a ref cannot go on guarding a panel that is gone.
   */
  onDirtyChange?: (dirty: boolean) => void;
  /** Already-interpolated usage count text, e.g. "3 items". */
  formatCount: (count: number) => string;
  labels: TagEditModalLabels;
}

/**
 * What the user has typed / picked against one row but not yet saved. Absent
 * fields keep following the live tag (see the overlay note at the top).
 */
interface TagRowEdits {
  name?: string;
  color?: string | null;
  icon?: string | null;
}

/**
 * What one press of a row's save button would write — and, by being empty,
 * whether the row has anything to write at all. Dirty state and the payload
 * come from this ONE function on purpose: derive them separately and the button
 * eventually appears for a change it then declines to send.
 */
type TagRowPatch = TagRowEdits;

function tagRowPatch(tag: TagEditRow, edits: TagRowEdits = {}): TagRowPatch {
  const patch: TagRowPatch = {};
  if (edits.name !== undefined) {
    const next = edits.name.trim();
    // A blank field is not a name. Mid-typing it is a normal state, so the row
    // also puts the stored name back on blur rather than leaving the screen and
    // the state disagreeing.
    if (next && next !== tag.name) patch.name = next;
  }
  if (edits.color !== undefined && edits.color !== tag.color)
    patch.color = edits.color;
  if (edits.icon !== undefined && edits.icon !== tag.icon)
    patch.icon = edits.icon;
  return patch;
}

/** Stable identity for "this row has nothing pending" — a fresh {} per render
 *  would defeat the row's memo-free equality checks for no benefit. */
const NO_EDITS: TagRowEdits = {};

export function TagEditModal({
  open,
  onClose,
  tags,
  onCreate,
  onRename,
  onDelete,
  onSetColor,
  onSetIcon,
  onUnassign,
  onDirtyChange,
  formatCount,
  labels,
}: TagEditModalProps): React.JSX.Element {
  const [draft, setDraft] = useState("");
  // Which tag rows have their item list open (#409). Collapsed on every open
  // so the panel always starts as a scannable tag list, never a wall of items.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  // The name-filter query (#368). Local UI state: the host owns WHICH tags
  // exist, this owns which of them are currently on screen.
  const [query, setQuery] = useState("");
  // Unsaved per-row edits, keyed by tag id (#715). Held here rather than in the
  // rows so the #368 filter cannot unmount them away.
  const [edits, setEdits] = useState<Readonly<Record<string, TagRowEdits>>>({});

  // Reset the add-field and the filter whenever the modal (re)opens, so the
  // panel never comes back mid-search showing a fraction of the tags —
  // adjusted during render (guarded on the open transition), not in an
  // effect (#586). prevOpen starts false so a mount that is ALREADY open
  // runs the same reset the old effect did.
  const [prevOpen, setPrevOpen] = useState(false);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setDraft("");
      setQuery("");
      setExpanded(new Set());
    }
    // Either direction drops the pending edits (#715). Dismissing the panel
    // discards them — that is the promise the save button makes — and clearing
    // on the way OUT (not only on the way back in) is what stops a closed panel
    // from going on reporting itself as dirty to the host.
    setEdits({});
  }

  const toggleExpanded = useCallback((tagId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }, []);

  const editRow = useCallback((tagId: string, patch: TagRowEdits) => {
    setEdits((prev) => ({ ...prev, [tagId]: { ...prev[tagId], ...patch } }));
  }, []);

  /**
   * Forget one pending field. Dropping the KEY (rather than writing the stored
   * value into it) is what puts the field back under the live tag, so a later
   * remote change still reaches it.
   */
  const dropRowEdit = useCallback((tagId: string, field: keyof TagRowEdits) => {
    setEdits((prev) => {
      const row = prev[tagId];
      if (!row || row[field] === undefined) return prev;
      const next = { ...row };
      delete next[field];
      return { ...prev, [tagId]: next };
    });
  }, []);

  // What each row's save button would write. Computed over ALL tags, not the
  // visible ones: a row hidden by the filter still holds its draft, and the
  // panel-wide dirty flag has to count it.
  const patchByTag = useMemo(() => {
    const map = new Map<string, TagRowPatch>();
    for (const tag of tags) {
      const patch = tagRowPatch(tag, edits[tag.id]);
      if (Object.keys(patch).length > 0) map.set(tag.id, patch);
    }
    return map;
  }, [tags, edits]);
  const dirty = patchByTag.size > 0;

  // Tell the host about the pending drafts so its close affordances can confirm
  // first. The ref keeps the unmount report from pinning a stale callback (and
  // from forcing every host to memoise the prop); refreshing it in an effect
  // rather than during render is what `react-hooks/refs` asks for — a render
  // React throws away must not leave a write behind.
  const onDirtyChangeRef = useRef(onDirtyChange);
  useEffect(() => {
    onDirtyChangeRef.current = onDirtyChange;
  });
  useEffect(() => {
    onDirtyChangeRef.current?.(dirty);
  }, [dirty]);
  useEffect(() => () => onDirtyChangeRef.current?.(false), []);

  /*
   * The only commit (#715). One press writes every field of that row that
   * moved, in the order the panel has always used — rename first, so whatever
   * the host propagates around a wiki-tag rename runs exactly where it used to.
   *
   * The edits are deliberately NOT cleared here: they are an overlay on the
   * live tag, so they stop being a pending change the moment the host's write
   * comes back through props. Clearing them now would snap the row back to the
   * old name for the length of the round trip.
   */
  const saveRow = useCallback(
    (tagId: string) => {
      const patch = patchByTag.get(tagId);
      if (!patch) return;
      if (patch.name !== undefined) onRename(tagId, patch.name);
      if (patch.icon !== undefined) onSetIcon(tagId, patch.icon);
      if (patch.color !== undefined) onSetColor(tagId, patch.color);
    },
    [patchByTag, onRename, onSetIcon, onSetColor],
  );

  const submitDraft = useCallback(() => {
    const name = draft.trim();
    if (!name) return;
    onCreate(name);
    setDraft("");
    // Clear the filter too (#368 QA): a tag created while a non-matching query
    // is active would land outside the visible list, so the panel would look
    // exactly as it did before — and pressing Add again hits the unique-name
    // constraint, which the host's fire-and-forget create swallows silently.
    setQuery("");
  }, [draft, onCreate]);

  // Case-insensitive substring on the name — the same contract the item-side
  // TagPicker uses for its candidate list, so "filtering tags" means one thing
  // across the app.
  const needle = query.trim().toLowerCase();
  const visibleTags = needle
    ? tags.filter((tag) => tag.name.toLowerCase().includes(needle))
    : tags;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={labels.title}
      className="max-w-[560px] p-0"
    >
      <div className="flex max-h-[80vh] flex-col">
        {/* Add row. */}
        <div className="flex flex-shrink-0 items-center gap-2 border-b border-lumen-border px-5 pb-3.5 pt-1">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Never commit mid-IME-composition (§frontend gotcha).
              if (isImeComposing(e)) return;
              if (e.key === "Enter") {
                e.preventDefault();
                submitDraft();
              }
            }}
            placeholder={labels.addPlaceholder}
            aria-label={labels.addButton}
            className={cn(
              "min-w-0 flex-1 rounded-lumen-md border border-lumen-border bg-lumen-bg px-2.5 py-1.5 text-sm text-lumen-text",
              "placeholder:text-lumen-text-tertiary",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
            )}
          />
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<Plus size={14} />}
            onClick={submitDraft}
            disabled={!draft.trim()}
          >
            {labels.addButton}
          </Button>
        </div>

        {/* Filter row (#368). Hidden while there is nothing to narrow — an
            empty panel should show its "no tags yet" copy, not a search box. */}
        {tags.length > 0 && (
          <div className="flex-shrink-0 border-b border-lumen-border px-5 py-2.5">
            <SidebarFilterField
              value={query}
              onChange={setQuery}
              placeholder={labels.filterPlaceholder}
              ariaLabel={labels.filterLabel}
              size="md"
            />
          </div>
        )}

        {/* Tag list. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-2">
          {tags.length === 0 ? (
            <p className="px-1 py-6 text-center text-sm text-lumen-text-tertiary">
              {labels.empty}
            </p>
          ) : visibleTags.length === 0 ? (
            <p className="px-1 py-6 text-center text-sm text-lumen-text-tertiary">
              {labels.filterEmpty}
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {visibleTags.map((tag) => (
                <TagEditRowItem
                  key={tag.id}
                  tag={tag}
                  edits={edits[tag.id] ?? NO_EDITS}
                  dirty={patchByTag.has(tag.id)}
                  expanded={expanded.has(tag.id)}
                  onToggleExpanded={toggleExpanded}
                  onEdit={editRow}
                  onDropEdit={dropRowEdit}
                  onSave={saveRow}
                  onDelete={onDelete}
                  onUnassign={onUnassign}
                  formatCount={formatCount}
                  labels={labels}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

interface TagEditRowItemProps {
  tag: TagEditRow;
  /** This row's unsaved edits, overlaid on `tag` for display (#715). */
  edits: TagRowEdits;
  /** Whether those edits amount to something the save button would write. */
  dirty: boolean;
  expanded: boolean;
  onToggleExpanded: (tagId: string) => void;
  onEdit: (tagId: string, patch: TagRowEdits) => void;
  onDropEdit: (tagId: string, field: keyof TagRowEdits) => void;
  onSave: (tagId: string) => void;
  onDelete: (id: string) => void;
  onUnassign?: (assignmentId: string) => void;
  formatCount: (count: number) => string;
  labels: TagEditModalLabels;
}

function TagEditRowItem({
  tag,
  edits,
  dirty,
  expanded,
  onToggleExpanded,
  onEdit,
  onDropEdit,
  onSave,
  onDelete,
  onUnassign,
  formatCount,
  labels,
}: TagEditRowItemProps) {
  // Live tag underneath, the user's own edits on top. An untouched field has no
  // local state at all, so an outside rename (#586: another surface, sync, MCP)
  // simply shows up.
  const name = edits.name ?? tag.name;
  const color = edits.color !== undefined ? edits.color : tag.color;
  const icon = edits.icon !== undefined ? edits.icon : tag.icon;

  const save = useCallback(() => onSave(tag.id), [onSave, tag.id]);

  // A blank field is not a name (`tagRowPatch` refuses to save one), so leaving
  // it empty would show one thing and mean another. Dropping the edit puts the
  // stored name back on screen, which is what the row is actually holding.
  const restoreClearedName = useCallback(() => {
    if (edits.name !== undefined && !edits.name.trim())
      onDropEdit(tag.id, "name");
  }, [edits.name, onDropEdit, tag.id]);

  // The membership list is opt-in per row: a row without `items` keeps the
  // pre-#409 static count pill (nothing to disclose).
  const items = tag.items;
  const countText = formatCount(tag.count);

  return (
    <li className="rounded-lumen-md">
      <div className="flex items-center gap-2 rounded-lumen-md px-1 py-1.5 hover:bg-lumen-hover">
        <TagIconPicker
          current={icon}
          color={color}
          onPick={(next) => onEdit(tag.id, { icon: next })}
          labels={labels}
        />

        <input
          value={name}
          onChange={(e) => onEdit(tag.id, { name: e.target.value })}
          onBlur={restoreClearedName}
          onKeyDown={(e) => {
            // Never commit mid-IME-composition (§frontend gotcha): the Enter
            // that confirms a Japanese conversion must not save the row.
            if (isImeComposing(e)) return;
            // Enter saves rather than blurs. Blur no longer commits anything
            // (#715), so "Enter blurs to commit" would have left the key doing
            // nothing visible at all. Escape is not handled here: the dialog
            // layer takes it in the capture phase to close the panel
            // (useDialogA11y), which discards the drafts either way.
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
          }}
          aria-label={labels.renameLabel}
          className={cn(
            "min-w-0 flex-1 rounded-lumen-sm border border-transparent bg-transparent px-1.5 py-1 text-sm text-lumen-text",
            "hover:border-lumen-border focus-visible:border-lumen-border",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
            // An unsaved row says so on the field itself, not only through the
            // button appearing next to it.
            dirty && "border-lumen-accent",
          )}
        />

        {/* The one commit (#715). Present only while this row has something to
            write: a list of twenty tags would otherwise carry twenty dead save
            buttons, and a control that is pressable and does nothing is worse
            than one that is not there (#434 S-1). Its appearance IS the
            "unsaved" state — nothing else in the row changes on its own. */}
        {dirty && (
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<Check size={13} aria-hidden />}
            onClick={save}
            aria-label={`${labels.saveLabel}: ${tag.name}`}
            className="shrink-0"
          >
            {labels.saveLabel}
          </Button>
        )}

        {/* The count pill doubles as the item-list disclosure (#409): the number
            the user is already reading is the thing they want to look inside. */}
        {items ? (
          <button
            type="button"
            onClick={() => onToggleExpanded(tag.id)}
            aria-expanded={expanded}
            aria-label={`${labels.itemsToggleLabel}: ${tag.name}`}
            className={cn(
              "flex shrink-0 items-center gap-0.5 rounded-full bg-lumen-bg-secondary py-0.5 pl-2 pr-1",
              "text-xs font-medium tabular-nums text-lumen-text-secondary",
              "transition-colors hover:bg-lumen-border hover:text-lumen-text",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
            )}
          >
            {countText}
            {expanded ? (
              <ChevronDown size={12} aria-hidden />
            ) : (
              <ChevronRight size={12} aria-hidden />
            )}
          </button>
        ) : (
          <span className="shrink-0 rounded-full bg-lumen-bg-secondary px-2 py-0.5 text-xs font-medium tabular-nums text-lumen-text-secondary">
            {countText}
          </span>
        )}

        <ColorPicker
          current={color ?? undefined}
          label={labels.colorLabel}
          clearLabel={labels.colorClearLabel}
          customLabel={labels.colorCustomLabel}
          onPick={(next) => onEdit(tag.id, { color: next })}
        />

        <button
          type="button"
          onClick={() => onDelete(tag.id)}
          aria-label={labels.deleteLabel}
          title={labels.deleteLabel}
          className={cn(
            "shrink-0 rounded-lumen-sm p-1 text-lumen-text-tertiary",
            "transition-colors hover:bg-lumen-danger-subtle hover:text-lumen-danger",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
          )}
        >
          <Trash2 size={14} aria-hidden />
        </button>
      </div>

      {items && expanded && (
        <TaggedItemList items={items} onUnassign={onUnassign} labels={labels} />
      )}
    </li>
  );
}

interface TaggedItemListProps {
  items: readonly TagEditItem[];
  onUnassign?: (assignmentId: string) => void;
  labels: TagEditModalLabels;
}

/*
 * The items carrying one tag (#409). Indented under its tag row and rendered
 * in the order the host supplied (grouped by kind — see itemRoleSortKey), so
 * the badges form runs instead of alternating. Each row is kind badge + title +
 * remove; removal detaches the tag from that item, it never deletes the item.
 */
function TaggedItemList({ items, onUnassign, labels }: TaggedItemListProps) {
  if (items.length === 0) {
    return (
      <p className="border-l border-lumen-border py-2 pl-3 ml-4 text-[12.5px] text-lumen-text-tertiary">
        {labels.itemsEmpty}
      </p>
    );
  }

  return (
    <ul className="ml-4 flex flex-col border-l border-lumen-border pl-1.5">
      {items.map((item) => (
        <li
          key={item.assignmentId}
          className="flex items-center gap-2 rounded-lumen-sm px-1.5 py-1 hover:bg-lumen-hover"
        >
          <ItemRoleBadge role={item.role} labels={labels.roles} />
          <span
            className="min-w-0 flex-1 truncate text-[12.5px] text-lumen-text"
            title={item.title}
          >
            {item.title}
          </span>
          <button
            type="button"
            onClick={() => onUnassign?.(item.assignmentId)}
            aria-label={`${labels.unassignLabel}: ${item.title}`}
            title={labels.unassignLabel}
            className={cn(
              "shrink-0 rounded-lumen-sm p-0.5 text-lumen-text-tertiary",
              "transition-colors hover:bg-lumen-danger-subtle hover:text-lumen-danger",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
            )}
          >
            <X size={13} aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}

interface TagIconPickerProps {
  current: string | null;
  color: string | null;
  onPick: (icon: string | null) => void;
  labels: TagEditModalLabels;
}

/** Inline icon picker: a trigger showing the current (resolved) icon, opening a
 *  curated grid below itself. Mirrors ColorPicker's open/close semantics. */
function TagIconPicker({ current, color, onPick, labels }: TagIconPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = useCallback(
    (name: string | null) => {
      onPick(name);
      setOpen(false);
    },
    [onPick],
  );

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label={labels.iconLabel}
        aria-expanded={open}
        title={labels.iconLabel}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-lumen-sm border border-lumen-border bg-lumen-bg text-lumen-text-secondary",
          "transition-colors hover:bg-lumen-hover hover:text-lumen-text",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
        )}
      >
        {/* Resolved through TagHeadingIcon (not a capitalized local) so the
            trigger draws the same glyph as a tag heading without declaring a
            component during render — see that file's note (#364 / #421). */}
        <TagHeadingIcon icon={current} color={color} />
      </button>

      {open && (
        <div
          role="group"
          aria-label={labels.iconLabel}
          /* Floats over the Modal panel, which is itself bg-lumen-bg — painting
             the popover with the same token left it with zero surface contrast,
             so the rows behind read straight through it (#552). It was never
             literally translucent; bg-secondary is the opaque step that makes
             the lift visible in BOTH themes (#f5ebda / #18243c), with the
             strong border + lg shadow + z-50 popover stacking Menu.tsx uses. */
          className={cn(
            "absolute left-0 top-9 z-50 rounded-lumen-md p-2",
            "border border-lumen-border-strong bg-lumen-bg-secondary shadow-lumen-lg",
          )}
        >
          <div className="grid grid-cols-6 gap-1">
            {TAG_ICON_CHOICES.map((choiceName) => {
              const Choice = resolveTagIcon(choiceName) ?? TagIcon;
              const active = current === choiceName;
              return (
                <button
                  key={choiceName}
                  type="button"
                  aria-label={choiceName}
                  aria-pressed={active}
                  title={choiceName}
                  onClick={() => pick(choiceName)}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-lumen-sm text-lumen-text-secondary",
                    "transition-colors hover:bg-lumen-hover hover:text-lumen-text",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
                    active && "bg-lumen-accent-subtle text-lumen-accent",
                  )}
                >
                  <Choice size={15} aria-hidden />
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => pick(null)}
            className={cn(
              "mt-1.5 flex w-full items-center gap-1.5 rounded-lumen-sm px-2 py-1 text-[0.75rem] font-medium text-lumen-text-secondary",
              "transition-colors hover:bg-lumen-hover hover:text-lumen-text",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
            )}
          >
            <Check
              size={13}
              aria-hidden
              className={current ? "opacity-0" : ""}
            />
            {labels.clearIconLabel}
          </button>
        </div>
      )}
    </div>
  );
}
