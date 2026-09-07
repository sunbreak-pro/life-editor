import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { Modal } from "../Modal";
import { Button } from "../Button";
import { ConfirmDialog } from "../ConfirmDialog";
import { cn } from "../cn";
import { FOCUS_RING_TIGHT } from "../styleTokens";
import { isImeComposing } from "../../utils/imeGuard";
import { DIALOG_AUTOFOCUS_SKIP } from "../../hooks/useDialogA11y";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { WIDE_QUERY } from "../../constants/breakpoints";
import { TagMasterList } from "./TagMasterList";
import { TagDetailPane } from "./TagDetailPane";
import {
  NO_EDITS,
  tagRowPatch,
  type TagRowEdits,
  type TagRowPatch,
} from "./tagRowPatch";
import { type TagEditModalProps } from "./types";

/*
 * Tag edit modal (#310 part 2, globalized in #409). A props-injected (§6.4)
 * manager for wiki_tags: add / rename / delete a tag and change its icon +
 * color, plus (#409) the items carrying it with a per-row unassign — the tag
 * master and its memberships in one panel.
 *
 * #896 split the one 1,050-line file into this directory. This file is the
 * panel's STATE — the drafts, the selection, the filter, the one commit — and
 * the two columns it hands them to live next door (TagMasterList /
 * TagDetailPane). Nothing about the behaviour or the exported names moved.
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
 * LAYOUT (#740, ユーザー裁定 D-20260812-tags-1 = 2 カラム). Master–detail: the
 * LEFT column lists the tags, the RIGHT column edits the one that is selected,
 * and narrow folds the two into two STEPS rather than two stacked panes. What
 * each column owes that arrangement is written where it is built —
 * TagMasterList (a width that never moves) and TagDetailPane (one save button,
 * parked in the footer).
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
 * Each tag's draft is an OVERLAY on the live tag (the #628 rule) — see
 * tagRowPatch.ts, which owns that model and the single derivation of "what
 * would one press write".
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
 * CLOSING IT (#1526). The header carries its own × — a 44px button, matching
 * what every BottomSheet has had since #525. Before this the panel's only exits
 * were Escape and the backdrop, and on a phone neither is an affordance: there
 * is no physical keyboard, and the backdrop is the thin margin around a panel
 * that fills the screen. So the header is built HERE rather than handed to
 * Modal as `title` — Modal's heading is a plain <h2> with no room for a control
 * beside it, and #1526's scope is this panel, not every dialog in the app. The
 * `labelledBy` prop is the seam that already existed for exactly this: the
 * dialog takes its accessible name from our own heading.
 *
 * DataService is unknown here — every mutation is a callback, every string a
 * label, colors reuse the shared ColorPicker, and the icon picker resolves
 * lucide names via the shared `tagIcon` helper (also consumed by #311).
 * lumen-* tokens only; the Modal owns the opaque panel + backdrop + Esc/
 * focus-trap (IME-guarded).
 */
/**
 * The heading the dialog is named by (#1526). A module constant rather than a
 * `useId()` because there is exactly one tag panel on screen at a time — the
 * host mounts it from the app shell — and a stable id keeps the tests reading
 * the same thing the browser does.
 */
const TITLE_ID = "tag-edit-modal-title";

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
        labelledBy={TITLE_ID}
        size="panel"
        padded={false}
      >
        {/* The heading Modal would otherwise draw, plus the close button it has
            no place for. Same box as before — `mb-3 px-5 pt-5` on the row, the
            same type on the <h2> — so the panel's top edge is unchanged. The
            button's 44px box is pulled back with negative margins (BottomSheet's
            trick) so a full-size tap target does not make the header taller. */}
        <div className="mb-3 flex items-center justify-between gap-2 px-5 pt-5">
          <h2
            id={TITLE_ID}
            className="min-w-0 text-base font-semibold text-lumen-text"
          >
            {labels.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={labels.closeLabel}
            /* The add field stays the panel's opening focus: this button is
               first in DOM order, and without the opt-out the dialog would
               land the user on "close" every time it opens. */
            {...DIALOG_AUTOFOCUS_SKIP}
            className={cn(
              "-my-2.5 -mr-2 grid size-11 shrink-0 place-items-center rounded-full",
              "text-lumen-text-secondary transition-colors",
              "hover:bg-lumen-hover hover:text-lumen-text",
              FOCUS_RING_TIGHT,
            )}
          >
            <X size={18} aria-hidden />
          </button>
        </div>

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
