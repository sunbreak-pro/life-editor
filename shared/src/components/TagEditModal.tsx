import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Plus,
  Tag as TagIcon,
  Trash2,
  X,
} from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { ColorPicker } from "./ColorPicker";
import { ConfirmDialog } from "./ConfirmDialog";
import { cn } from "./cn";
import { resolveTagIcon, TAG_ICON_CHOICES } from "./tagIcon";
import { TagHeadingIcon } from "./TagHeadingIcon";
import { ItemRoleBadge } from "./items/ItemRoleBadge";
import { type ItemRoleLabels } from "./items/itemRole";
import { SidebarFilterField } from "./materials/SidebarFilterField";
import { isImeComposing } from "../utils/imeGuard";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { WIDE_QUERY } from "../constants/breakpoints";

/*
 * Tag edit modal (#310 part 2, globalized in #409). A props-injected (§6.4)
 * manager for wiki_tags: add / rename / delete a tag and change its icon +
 * color, plus (#409) the items carrying it with a per-row unassign — the tag
 * master and its memberships in one panel.
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
 * LAYOUT (#740, ユーザー裁定 D-20260812-tags-1 = 2 カラム). Master–detail:
 * the LEFT column lists the tags (colored glyph + name + count and nothing
 * else, so its width never moves), the RIGHT column edits the one that is
 * selected. Before this every row carried all six controls — icon, name, save,
 * count, color, delete — squeezed into one line, and the save button appeared
 * only on the row being typed into, which shoved the three controls right of it
 * sideways on every keystroke that started or ended a draft. With one editing
 * surface there is exactly ONE save button, parked in the footer where #681's
 * detail pane puts it, and nothing in the layout depends on whether a draft
 * exists.
 *
 * Narrow (phone) folds the two columns into two STEPS rather than two stacked
 * panes: the list fills the panel, picking a tag replaces it with the editor,
 * and the editor carries a back link. Two half-height panes on a phone would
 * make both of them unusable, and side-by-side would need a horizontal scroll.
 *
 * SAVE BUTTON (#715, Epic #627 — ユーザー裁定 D-20260810-sched-1 = A). Editing
 * an EXISTING tag — its name, its icon, its color — is a draft, and nothing
 * reaches the host until the save button is pressed. Blur writes nothing.
 * Before this the name committed on blur while the two pickers wrote on the
 * click, so one panel confirmed edits two different ways and merely tabbing out
 * of the field renamed a tag — a rename that does not stop at this screen,
 * since a wiki tag is referenced from every item carrying it.
 *
 * The pending edits live HERE, not in the editor pane, for two reasons: the
 * #368 filter unmounts the rows it hides, and (since #740) selecting another
 * tag unmounts the editor itself. Drafts held any lower would be thrown away by
 * typing in the search box or by a stray click in the list, silently, which is
 * the exact loss the save button exists to make impossible. Holding them by tag
 * id also means the panel-wide dirty flag (`onDirtyChange`) counts tags that
 * are neither selected nor visible.
 *
 * Each tag's draft is an OVERLAY on the live tag (the #628 rule): only the
 * fields actually typed against are held, so a rename landing from Realtime or
 * MCP still reaches an untouched tag instead of being reverted by a stale draft
 * the user never edited.
 *
 * Switching tags with something pending asks first (#740 DoD), through the
 * in-app <ConfirmDialog> the rest of the app uses since #729 — never the
 * browser's own confirm, which lands outside the theme and freezes the page
 * hard enough to stall Playwright. Refusing keeps both the draft and the
 * selection.
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

/** One item carrying a tag, as listed in the editor pane (#409). */
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
   * The items behind `count`, listed in the editor pane (#409). Omit to keep
   * the tag count-only (no membership section) — the pre-#409 behavior.
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
  /** #740 aria-label for the master list of tags. */
  listLabel: string;
  /** aria-label for the name input in the editor pane. */
  renameLabel: string;
  /**
   * #715 save button: the only thing that commits the selected tag's pending
   * name / icon / color. One per panel since #740, parked in the footer.
   */
  saveLabel: string;
  /** #740 footer state, mirroring #681: nothing pending. */
  savedLabel: string;
  /** #740 footer state, mirroring #681: something pending. */
  unsavedLabel: string;
  /** aria-label for the delete button in the editor pane. */
  deleteLabel: string;
  /** Trigger + group label for the icon picker. */
  iconLabel: string;
  /** "Default / no icon" option in the icon picker. */
  clearIconLabel: string;
  /** ColorPicker labels. */
  colorLabel: string;
  colorClearLabel: string;
  colorCustomLabel: string;
  /** #740 copy filling the editor pane while no tag is selected. */
  detailEmpty: string;
  /** #740 narrow layout: back from the editor to the list. */
  backLabel: string;
  /** #409 item list: heading over the items carrying the selected tag. */
  itemsHeading: string;
  /** #409 item list: copy shown when the selected tag carries nothing. */
  itemsEmpty: string;
  /** #409 item list: aria-label for a row's "remove this tag" button. */
  unassignLabel: string;
  /** #740 in-app confirm shown when switching tags with unsaved edits. */
  switchConfirm: string;
  /** #740 affirmative of that confirm ("discard"). */
  discardLabel: string;
  /** #740 refusal of that confirm ("cancel"). */
  cancelLabel: string;
  /** #409 item list: already-translated item-kind names for the role badge. */
  roles: ItemRoleLabels;
}

export interface TagEditModalProps {
  open: boolean;
  onClose: () => void;
  tags: readonly TagEditRow[];
  onCreate: (name: string) => void;
  /**
   * Rename a tag (#715: fires from the save button, never from a blur). The
   * name arrives trimmed and different from the stored one — a blank or
   * unchanged draft is not a rename, so the propagation the host does around
   * `renameTag` is reached exactly when it was before.
   */
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  /** Set a tag's color (#715: from the save button, not the swatch click). */
  onSetColor: (id: string, color: string | null) => void;
  /** Set a tag's icon (#715: from the save button, not the icon click). */
  onSetIcon: (id: string, icon: string | null) => void;
  /**
   * Remove one item↔tag assignment (#409). Required whenever any tag supplies
   * `items`; a tag without `items` shows no membership section, so it is never
   * called for one.
   */
  onUnassign?: (assignmentId: string) => void;
  /**
   * Report whether ANY tag is holding unsaved edits (#715, mirroring #628's
   * `onDirtyChange`). The host owns the close affordances — Esc, the backdrop,
   * whatever opened the panel — so it is the only place that can ask "discard?"
   * before one of them throws the drafts away. Fires with `false` on unmount so
   * a host parking this in a ref cannot go on guarding a panel that is gone.
   */
  onDirtyChange?: (dirty: boolean) => void;
  /** Already-interpolated usage count text, e.g. "3 items". */
  formatCount: (count: number) => string;
  /** matchMedia query for the two-column layout. Overridable for tests. */
  wideQuery?: string;
  labels: TagEditModalLabels;
}

/**
 * What the user has typed / picked against one tag but not yet saved. Absent
 * fields keep following the live tag (see the overlay note at the top).
 */
interface TagRowEdits {
  name?: string;
  color?: string | null;
  icon?: string | null;
}

/**
 * What one press of the save button would write — and, by being empty, whether
 * the selected tag has anything to write at all. Dirty state and the payload
 * come from this ONE function on purpose: derive them separately and the button
 * eventually enables for a change it then declines to send.
 */
type TagRowPatch = TagRowEdits;

function tagRowPatch(tag: TagEditRow, edits: TagRowEdits = {}): TagRowPatch {
  const patch: TagRowPatch = {};
  if (edits.name !== undefined) {
    const next = edits.name.trim();
    // A blank field is not a name. Mid-typing it is a normal state, so the
    // editor also puts the stored name back on blur rather than leaving the
    // screen and the state disagreeing.
    if (next && next !== tag.name) patch.name = next;
  }
  if (edits.color !== undefined && edits.color !== tag.color)
    patch.color = edits.color;
  if (edits.icon !== undefined && edits.icon !== tag.icon)
    patch.icon = edits.icon;
  return patch;
}

/** Stable identity for "this tag has nothing pending" — a fresh {} per render
 *  would defeat the equality checks downstream for no benefit. */
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
  wideQuery = WIDE_QUERY,
  labels,
}: TagEditModalProps): React.JSX.Element {
  const [draft, setDraft] = useState("");
  // The name-filter query (#368). Local UI state: the host owns WHICH tags
  // exist, this owns which of them are currently on screen.
  const [query, setQuery] = useState("");
  // Unsaved edits, keyed by tag id (#715). Held here rather than in the editor
  // pane so neither the #368 filter nor a change of selection can unmount them
  // away.
  const [edits, setEdits] = useState<Readonly<Record<string, TagRowEdits>>>({});
  // Which tag the right column is editing (#740). Nothing is selected on open:
  // the panel is also the place you come to just to READ the tag master, and
  // auto-selecting would open the phone layout straight into an editor for a
  // tag nobody asked about (P-006 — micro judgment, noted in the PR).
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // A selection the user asked for while the current one has unsaved edits,
  // held until the discard question is answered (#740).
  const [pendingSelectId, setPendingSelectId] = useState<string | null>(null);

  // Two columns side by side, or two steps (#740). Wide is the jsdom fallback,
  // so a test that says nothing about width sees both columns.
  const wide = useMediaQuery(wideQuery, true);

  // Reset the add-field, the filter and the selection whenever the modal
  // (re)opens, so the panel never comes back mid-search showing a fraction of
  // the tags — adjusted during render (guarded on the open transition), not in
  // an effect (#586). prevOpen starts false so a mount that is ALREADY open
  // runs the same reset the old effect did.
  const [prevOpen, setPrevOpen] = useState(false);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setDraft("");
      setQuery("");
    }
    // Either direction drops the pending edits (#715) and the selection.
    // Dismissing the panel discards the drafts — that is the promise the save
    // button makes — and clearing on the way OUT (not only on the way back in)
    // is what stops a closed panel from going on reporting itself as dirty to
    // the host.
    setEdits({});
    setSelectedId(null);
    setPendingSelectId(null);
  }

  const editSelected = useCallback((tagId: string, patch: TagRowEdits) => {
    setEdits((prev) => ({ ...prev, [tagId]: { ...prev[tagId], ...patch } }));
  }, []);

  /**
   * Forget one pending field. Dropping the KEY (rather than writing the stored
   * value into it) is what puts the field back under the live tag, so a later
   * remote change still reaches it.
   */
  const dropEdit = useCallback((tagId: string, field: keyof TagRowEdits) => {
    setEdits((prev) => {
      const row = prev[tagId];
      if (!row || row[field] === undefined) return prev;
      const next = { ...row };
      delete next[field];
      return { ...prev, [tagId]: next };
    });
  }, []);

  // What the save button would write, per tag. Computed over ALL tags, not the
  // visible or selected one: a tag hidden by the filter still holds its draft,
  // and the panel-wide dirty flag has to count it.
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

  // The tag the editor pane is on. Resolved from props rather than kept as an
  // object, so a rename / recolor arriving from sync or MCP reaches the open
  // editor — and so deleting the selected tag simply empties the pane instead
  // of leaving it editing something that no longer exists.
  const selectedTag = useMemo(
    () => tags.find((tag) => tag.id === selectedId) ?? null,
    [tags, selectedId],
  );
  const selectedDirty = selectedTag ? patchByTag.has(selectedTag.id) : false;

  /*
   * The only commit (#715). One press writes every field of the selected tag
   * that moved, in the order the panel has always used — rename first, so
   * whatever the host propagates around a wiki-tag rename runs exactly where it
   * used to.
   *
   * The edits are deliberately NOT cleared here: they are an overlay on the
   * live tag, so they stop being a pending change the moment the host's write
   * comes back through props. Clearing them now would snap the field back to
   * the old name for the length of the round trip.
   */
  const saveSelected = useCallback(() => {
    if (!selectedTag) return;
    const patch = patchByTag.get(selectedTag.id);
    if (!patch) return;
    if (patch.name !== undefined) onRename(selectedTag.id, patch.name);
    if (patch.icon !== undefined) onSetIcon(selectedTag.id, patch.icon);
    if (patch.color !== undefined) onSetColor(selectedTag.id, patch.color);
  }, [selectedTag, patchByTag, onRename, onSetIcon, onSetColor]);

  /*
   * Selecting another tag unmounts the editor, so a pending draft has to be
   * asked about before it goes (#740). The question is deferred, not the
   * selection: `pendingSelectId` holds where the user was going and the current
   * selection stays put — refusing has to leave the screen exactly as it was.
   */
  const selectTag = useCallback(
    (tagId: string) => {
      if (tagId === selectedId) return;
      if (selectedId && patchByTag.has(selectedId)) {
        setPendingSelectId(tagId);
        return;
      }
      setSelectedId(tagId);
    },
    [selectedId, patchByTag],
  );

  const confirmSwitch = useCallback(() => {
    // Discard means discard: the draft the user chose to abandon must not be
    // waiting for them when they come back to the tag, and leaving it behind
    // would also keep the panel reporting itself dirty to the host.
    if (selectedId) {
      setEdits((prev) => {
        if (!prev[selectedId]) return prev;
        const next = { ...prev };
        delete next[selectedId];
        return next;
      });
    }
    setSelectedId(pendingSelectId);
    setPendingSelectId(null);
  }, [selectedId, pendingSelectId]);

  const cancelSwitch = useCallback(() => setPendingSelectId(null), []);

  // Narrow only. Stepping back to the list keeps the draft — nothing is lost,
  // so there is nothing to ask about; the tag stays marked as unsaved in the
  // list and re-opening it shows what was typed.
  const backToList = useCallback(() => setSelectedId(null), []);

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

  // Which column is on screen. Wide shows both; narrow shows the editor only
  // once a tag is picked, and the list until then.
  const showList = wide || !selectedTag;
  const showDetail = wide || selectedTag !== null;

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={labels.title}
        className="max-w-[860px] p-0"
      >
        {/* A fixed height, not a content-driven one: the panel must not resize
            when a tag with twenty items is selected after one with none. */}
        <div className="flex h-[560px] max-h-[80vh] flex-col">
          {/* Add row — above both columns, because creating a tag belongs to
              the master list rather than to whatever is being edited. */}
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

          <div className="flex min-h-0 flex-1">
            {showList && (
              <TagMasterList
                tags={tags}
                visibleTags={visibleTags}
                edits={edits}
                patchByTag={patchByTag}
                selectedId={selectedTag?.id ?? null}
                onSelect={selectTag}
                query={query}
                onQueryChange={setQuery}
                formatCount={formatCount}
                wide={wide}
                labels={labels}
              />
            )}

            {showDetail &&
              (selectedTag ? (
                <TagDetailPane
                  key={selectedTag.id}
                  tag={selectedTag}
                  edits={edits[selectedTag.id] ?? NO_EDITS}
                  dirty={selectedDirty}
                  wide={wide}
                  onBack={backToList}
                  onEdit={editSelected}
                  onDropEdit={dropEdit}
                  onSave={saveSelected}
                  onDelete={onDelete}
                  onUnassign={onUnassign}
                  formatCount={formatCount}
                  labels={labels}
                />
              ) : (
                <div className="flex min-w-0 flex-1 items-center justify-center px-6">
                  <p className="text-center text-sm text-lumen-text-tertiary">
                    {labels.detailEmpty}
                  </p>
                </div>
              ))}
          </div>
        </div>
      </Modal>

      {/* Mounted outside the Modal so it portals ABOVE the panel it is asked
          from — the discard question has to sit on top of the thing it is
          about (#707 / #729). useDialogA11y's layer stack hands Escape to this
          one while it is up, so answering it never tears the panel down too. */}
      {pendingSelectId !== null && (
        <ConfirmDialog
          open
          message={labels.switchConfirm}
          confirmLabel={labels.discardLabel}
          cancelLabel={labels.cancelLabel}
          // Throwing away typed-in work is the destructive answer here, even
          // though nothing is deleted from the database.
          danger
          onConfirm={confirmSwitch}
          onCancel={cancelSwitch}
        />
      )}
    </>
  );
}

interface TagMasterListProps {
  tags: readonly TagEditRow[];
  visibleTags: readonly TagEditRow[];
  edits: Readonly<Record<string, TagRowEdits>>;
  patchByTag: ReadonlyMap<string, TagRowPatch>;
  selectedId: string | null;
  onSelect: (tagId: string) => void;
  query: string;
  onQueryChange: (query: string) => void;
  formatCount: (count: number) => string;
  wide: boolean;
  labels: TagEditModalLabels;
}

/*
 * The master column (#740): filter + the tag list, and nothing that edits.
 *
 * Each row is one button carrying the tag's glyph, its name and its count —
 * three read-only things, so the column's width is the same whatever state the
 * panel is in. A tag holding unsaved edits shows its DRAFT name (the same
 * overlay the editor reads) plus an accent dot, so the list and the editor
 * never disagree about what the tag is currently called.
 */
function TagMasterList({
  tags,
  visibleTags,
  edits,
  patchByTag,
  selectedId,
  onSelect,
  query,
  onQueryChange,
  formatCount,
  wide,
  labels,
}: TagMasterListProps) {
  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-col",
        // A fixed rail beside the editor; the whole panel on a phone.
        wide ? "w-[260px] shrink-0 border-r border-lumen-border" : "flex-1",
      )}
    >
      {/* Filter row (#368). Hidden while there is nothing to narrow — an empty
          panel should show its "no tags yet" copy, not a search box. */}
      {tags.length > 0 && (
        <div className="flex-shrink-0 border-b border-lumen-border px-3 py-2.5">
          <SidebarFilterField
            value={query}
            onChange={onQueryChange}
            placeholder={labels.filterPlaceholder}
            ariaLabel={labels.filterLabel}
            size="md"
          />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {tags.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-lumen-text-tertiary">
            {labels.empty}
          </p>
        ) : visibleTags.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-lumen-text-tertiary">
            {labels.filterEmpty}
          </p>
        ) : (
          <ul aria-label={labels.listLabel} className="flex flex-col gap-0.5">
            {visibleTags.map((tag) => {
              const rowEdits = edits[tag.id] ?? NO_EDITS;
              const name = rowEdits.name ?? tag.name;
              const color =
                rowEdits.color !== undefined ? rowEdits.color : tag.color;
              const icon =
                rowEdits.icon !== undefined ? rowEdits.icon : tag.icon;
              const rowDirty = patchByTag.has(tag.id);
              const active = tag.id === selectedId;
              const countText = formatCount(tag.count);
              return (
                <li key={tag.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(tag.id)}
                    aria-current={active ? "true" : undefined}
                    // Spelled out rather than left to the concatenated content,
                    // so the count is announced with the name instead of as a
                    // loose number after it.
                    aria-label={`${name}: ${countText}`}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lumen-md px-2 py-1.5 text-left",
                      "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
                      active
                        ? "bg-lumen-accent-subtle text-lumen-text"
                        : "text-lumen-text hover:bg-lumen-hover",
                    )}
                  >
                    <TagHeadingIcon icon={icon} color={color} />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {name}
                    </span>
                    {/* The unsaved marker (#740): the save button no longer
                        appears and disappears, so the list is where a draft on
                        a tag you are not looking at stays visible. */}
                    {rowDirty && (
                      <span
                        aria-hidden
                        className="size-1.5 shrink-0 rounded-full bg-lumen-accent"
                      />
                    )}
                    <span
                      aria-hidden
                      className="shrink-0 rounded-full bg-lumen-bg-secondary px-2 py-0.5 text-xs font-medium tabular-nums text-lumen-text-secondary"
                    >
                      {countText}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

interface TagDetailPaneProps {
  tag: TagEditRow;
  /** The selected tag's unsaved edits, overlaid on `tag` for display (#715). */
  edits: TagRowEdits;
  /** Whether those edits amount to something the save button would write. */
  dirty: boolean;
  wide: boolean;
  onBack: () => void;
  onEdit: (tagId: string, patch: TagRowEdits) => void;
  onDropEdit: (tagId: string, field: keyof TagRowEdits) => void;
  onSave: () => void;
  onDelete: (id: string) => void;
  onUnassign?: (assignmentId: string) => void;
  formatCount: (count: number) => string;
  labels: TagEditModalLabels;
}

/*
 * The detail column (#740): everything that edits ONE tag, with the single save
 * button in the footer (#681's arrangement — delete on the left, state text and
 * save on the right) so no control moves as drafts come and go.
 */
function TagDetailPane({
  tag,
  edits,
  dirty,
  wide,
  onBack,
  onEdit,
  onDropEdit,
  onSave,
  onDelete,
  onUnassign,
  formatCount,
  labels,
}: TagDetailPaneProps) {
  // Live tag underneath, the user's own edits on top. An untouched field has no
  // local state at all, so an outside rename (#586: another surface, sync, MCP)
  // simply shows up.
  const name = edits.name ?? tag.name;
  const color = edits.color !== undefined ? edits.color : tag.color;
  const icon = edits.icon !== undefined ? edits.icon : tag.icon;

  // A blank field is not a name (`tagRowPatch` refuses to save one), so leaving
  // it empty would show one thing and mean another. Dropping the edit puts the
  // stored name back on screen, which is what the panel is actually holding.
  const restoreClearedName = useCallback(() => {
    if (edits.name !== undefined && !edits.name.trim())
      onDropEdit(tag.id, "name");
  }, [edits.name, onDropEdit, tag.id]);

  // The membership list is opt-in per tag: a tag without `items` keeps the
  // pre-#409 count-only shape (nothing to list).
  const items = tag.items;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* Narrow only: the list is not on screen, so the editor has to offer the
          way back to it. */}
      {!wide && (
        <div className="flex-shrink-0 border-b border-lumen-border px-3 py-2">
          <button
            type="button"
            onClick={onBack}
            className={cn(
              "flex items-center gap-1.5 rounded-lumen-sm px-1.5 py-1 text-sm font-medium text-lumen-text-secondary",
              "transition-colors hover:bg-lumen-hover hover:text-lumen-text",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
            )}
          >
            <ArrowLeft size={14} aria-hidden />
            {labels.backLabel}
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
        {/* Identity row: icon, name, color — the three fields one save covers. */}
        <div className="flex items-center gap-2">
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
              // that confirms a Japanese conversion must not save the tag.
              if (isImeComposing(e)) return;
              // Enter saves rather than blurs. Blur no longer commits anything
              // (#715), so "Enter blurs to commit" would have left the key
              // doing nothing visible at all. Escape is not handled here: the
              // dialog layer takes it in the capture phase to close the panel
              // (useDialogA11y), which discards the drafts either way.
              if (e.key === "Enter") {
                e.preventDefault();
                onSave();
              }
            }}
            aria-label={labels.renameLabel}
            className={cn(
              "min-w-0 flex-1 rounded-lumen-md border border-lumen-border bg-lumen-bg px-2.5 py-1.5 text-sm text-lumen-text",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
              // An unsaved field says so on itself, not only through the
              // footer's state text.
              dirty && "border-lumen-accent",
            )}
          />

          <ColorPicker
            current={color ?? undefined}
            label={labels.colorLabel}
            clearLabel={labels.colorClearLabel}
            customLabel={labels.colorCustomLabel}
            onPick={(next) => onEdit(tag.id, { color: next })}
          />
        </div>

        {/* The items carrying this tag (#409). No disclosure any more: the
            editor pane is already about this one tag, so the list that used to
            hide under a count pill is simply the rest of the pane. */}
        {items && (
          <section aria-label={labels.itemsHeading} className="min-w-0">
            <h3 className="mb-1.5 flex items-baseline gap-2 text-xs font-semibold uppercase tracking-wide text-lumen-text-secondary">
              {labels.itemsHeading}
              <span className="text-xs font-medium normal-case tracking-normal tabular-nums text-lumen-text-tertiary">
                {formatCount(tag.count)}
              </span>
            </h3>
            <TaggedItemList
              items={items}
              onUnassign={onUnassign}
              labels={labels}
            />
          </section>
        )}
      </div>

      {/* Footer (#740, #681's arrangement). Both controls are always here and
          always in the same place; only the save button's enabled state moves,
          with the reason spelled out beside it so "why can I not press this"
          has an answer on screen rather than only in the button's opacity
          (#434 S-1). */}
      <div className="flex flex-shrink-0 items-center justify-between gap-3 border-t border-lumen-border px-5 py-3">
        <button
          type="button"
          onClick={() => onDelete(tag.id)}
          aria-label={labels.deleteLabel}
          className={cn(
            "flex items-center gap-1.5 rounded-lumen-sm px-1.5 py-1 text-sm font-medium text-lumen-danger",
            "transition-colors hover:bg-lumen-danger-subtle",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
          )}
        >
          <Trash2 size={14} aria-hidden />
          {labels.deleteLabel}
        </button>

        <div className="flex items-center gap-3">
          <span
            aria-live="polite"
            className={cn(
              "text-xs",
              dirty ? "text-lumen-accent" : "text-lumen-text-secondary",
            )}
          >
            {dirty ? labels.unsavedLabel : labels.savedLabel}
          </span>
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<Check size={13} aria-hidden />}
            onClick={onSave}
            disabled={!dirty}
          >
            {labels.saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface TaggedItemListProps {
  items: readonly TagEditItem[];
  onUnassign?: (assignmentId: string) => void;
  labels: TagEditModalLabels;
}

/*
 * The items carrying the selected tag (#409), rendered in the order the host
 * supplied (grouped by kind — see itemRoleSortKey), so the badges form runs
 * instead of alternating. Each row is kind badge + title + remove; removal
 * detaches the tag from that item, it never deletes the item.
 */
function TaggedItemList({ items, onUnassign, labels }: TaggedItemListProps) {
  if (items.length === 0) {
    return (
      <p className="py-2 text-[12.5px] text-lumen-text-tertiary">
        {labels.itemsEmpty}
      </p>
    );
  }

  return (
    <ul className="flex flex-col">
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
          "flex h-8 w-8 items-center justify-center rounded-lumen-md border border-lumen-border bg-lumen-bg text-lumen-text-secondary",
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
