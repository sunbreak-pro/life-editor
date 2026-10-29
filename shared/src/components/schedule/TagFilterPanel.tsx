import { useEffect, useRef, useState } from "react";
import { Check, Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "../cn";
import { IconButton } from "../IconButton";
import { SelectCheckbox } from "../SelectCheckbox";
import { SkeletonList } from "../SkeletonList";
import { TagHeadingIcon } from "../TagHeadingIcon";
import { isImeComposing } from "../../utils/imeGuard";
import {
  DISABLED_FILLED_BTN,
  FOCUS_RING_ON_ACCENT,
  FOCUS_RING_TIGHT,
} from "../styleTokens";

/*
 * TagFilterPanel (#1173) — what the Calendar toolbar's filter button opens.
 *
 * It replaced the calendars ledger, which asked the user to invent a second
 * noun ("a calendar") for something that was only ever a saved tag filter with
 * a name. The panel drops the noun and shows the two things that were actually
 * underneath it: which tags the grid is narrowed to right now, and the named
 * sets worth coming back to.
 *
 * Two-part layout, in the order the work happens: tick tags at the top, then
 * either save the ticks as a group or apply one you saved before. Saved groups
 * sit BELOW the ticks rather than in a sidebar because applying one WRITES the
 * ticks — putting the cause under the effect would make the list read as a
 * separate filter competing with the checkboxes.
 *
 * #2155 rebuilt the look from the Claude Design proposal: a quiet list, not a
 * form. A group row is ONE press — the row itself applies the group, and the
 * applied row (lit, with a check) takes it off again — with a pencil and a bin
 * beside it. Renaming moved into the pencil's editor, because a name drawn as
 * an always-open text field made every row look like a form to fill in. Saving
 * the ticks as a new group is one button that opens the name field only when
 * it is wanted. The ticks are the square selection box (#2217), not the
 * browser's own.
 *
 * Pure presentation (§3.1 / §6.4): copy arrives translated, every action is a
 * callback, lumen-* tokens only (§5). The only state it owns is drafts —
 * typing buffers and an editor's ticks — rather than app state.
 */

export interface TagFilterPanelTag {
  id: string;
  name: string;
  /** Optional hex tint from `wiki_tags.color`; tints the row's glyph. */
  color: string | null;
  /** Stored lucide icon name from `wiki_tags.icon`; null → the generic glyph. */
  icon: string | null;
  /** Rows this tag alone would leave on the grid. */
  count: number;
}

export interface TagFilterPanelGroup {
  id: string;
  name: string;
  /**
   * Already-resolved names of the group's LIVE tags. A group whose tags were
   * all soft-deleted arrives with an empty list — see `TagFilterPanelLabels
   * .groupEmpty` for what is said about it instead of offering a filter that
   * can only ever empty the grid.
   */
  tagNames: string[];
  /**
   * The group's LIVE tag ids — what the tag editor (#2142) starts ticked. Same
   * filter as `tagNames`, so a soft-deleted tag never comes back as a tick.
   */
  tagIds: string[];
  /** Whether the current tick list is exactly this group. */
  active: boolean;
  /**
   * Already-interpolated aria-labels for this row's icon buttons (e.g.
   * "Edit Work" / "Delete Work"). Per row rather than one shared label: a
   * column of identical "Delete" buttons would leave a screen reader with no
   * way to tell which group each one acts on.
   */
  editLabel: string;
  deleteLabel: string;
}

export interface TagFilterPanelLabels {
  /** Accessible name for the checkbox group. */
  tagsLabel: string;
  /** Shown instead of the list when no tag exists yet. */
  noTags: string;
  /** Announced while the tags are still arriving (the skeleton is silent). */
  tagsLoading: string;
  /** Button that unticks everything. */
  clear: string;
  /** Narrow-only button that closes the panel from the thumb's end. */
  close: string;
  /** Heading over the saved-group list. */
  groupsHeading: string;
  /** Shown instead of the group list when none exist yet. */
  groupsEmpty: string;
  /** Opens the name field that saves the current ticks as a group. */
  saveCurrent: string;
  /** Placeholder for the new-group name field. */
  namePlaceholder: string;
  /** Button that saves the current ticks as a group. */
  save: string;
  /** Hint under the save button while no tag is ticked. */
  saveHint: string;
  /** Saves the group editor's name and ticks. */
  editTagsSave: string;
  /** Closes a draft (the editor, the new-group field) without writing. */
  cancel: string;
  /** Hint in the tag editor while no tag is ticked (a group needs one). */
  editTagsHint: string;
  /** aria-label for the group editor's name field. */
  renameGroup: string;
  /** Said under the name of a group whose tags are all gone. */
  groupEmpty: string;
}

export interface TagFilterPanelProps {
  tags: TagFilterPanelTag[];
  selectedTagIds: string[];
  onToggleTag: (tagId: string) => void;
  onClear: () => void;
  groups: TagFilterPanelGroup[];
  onSaveGroup: (name: string) => void;
  onApplyGroup: (groupId: string) => void;
  /** Takes the applied group off — the tick list goes empty (#2142). */
  onReleaseGroup: () => void;
  /** Replaces the tags a group narrows to (#2142). Never called with []. */
  onUpdateGroupTags: (groupId: string, tagIds: string[]) => void;
  onRenameGroup: (groupId: string, name: string) => void;
  onDeleteGroup: (groupId: string) => void;
  /**
   * Closes the panel. When given, narrow draws a Close button at the foot of
   * the panel, next to Clear — the corner × of the frame is out of the
   * thumb's reach on a phone.
   */
  onClose?: () => void;
  /** True until the tag list has landed once (never during a background refetch). */
  tagsLoading?: boolean;
  labels: TagFilterPanelLabels;
  className?: string;
}

const SECTION_HEADING = "text-xs font-semibold text-lumen-text-secondary";

/* One line of the panel: a tag to tick, or a tag in a group's editor. */
const TAG_ROW =
  "flex cursor-pointer items-center gap-2.5 rounded-lumen-md px-2 py-1.5 text-sm text-lumen-text transition-colors hover:bg-lumen-hover max-md:min-h-11";

const TEXT_FIELD =
  "min-w-0 flex-1 rounded-lumen-md border border-lumen-border bg-lumen-bg px-2 py-1.5 text-sm text-lumen-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent max-md:min-h-11";

/* The filled commit of a draft (Save). Its dead state is the recess (#1803). */
const FILLED_BUTTON = cn(
  "rounded-lumen-md bg-lumen-accent px-3 py-1.5 text-sm font-medium text-lumen-on-accent transition-colors hover:bg-lumen-accent-hover max-md:min-h-11",
  FOCUS_RING_ON_ACCENT,
  DISABLED_FILLED_BTN,
);

const OUTLINE_BUTTON = cn(
  "rounded-lumen-md border border-lumen-border-strong px-3 py-1.5 text-sm font-medium text-lumen-text transition-colors hover:bg-lumen-hover max-md:min-h-11",
  FOCUS_RING_TIGHT,
);

/* A row's icon button: 32px on wide, the 44px floor on narrow (#1512). */
const ROW_ICON = "shrink-0 max-md:size-11";

function TagCheckRow({
  tag,
  checked,
  onToggle,
  showCount,
}: {
  tag: TagFilterPanelTag;
  checked: boolean;
  onToggle: () => void;
  showCount: boolean;
}) {
  return (
    // The label names the square: its text becomes the checkbox's accessible
    // name, and a press anywhere on the row presses it.
    <label className={TAG_ROW}>
      <SelectCheckbox checked={checked} onChange={onToggle} />
      {/* The tag's own glyph, not a colour dot (#1291): the same
          <TagHeadingIcon> the chips and the Tag hub draw, so a tag is
          recognisable here by the icon it was given rather than only by a
          tint that half the tags never set. */}
      <TagHeadingIcon icon={tag.icon} color={tag.color} size={15} />
      <span className="min-w-0 flex-1 truncate">{tag.name}</span>
      {showCount && (
        <span className="tabular-nums text-xs text-lumen-text-tertiary">
          {tag.count}
        </span>
      )}
    </label>
  );
}

/*
 * A group's editor (#2142, #2155), opened under its row by the pencil: the
 * name and the tags, both as DRAFTS. Nothing is written until Save, so
 * unticking the last tag on the way to ticking another never leaves a group
 * that narrows to nothing, and typing a name is one write, not one per
 * keystroke — the ledger this panel replaced sent a PATCH on every
 * `onChange`, each one a Realtime echo the section refetches on.
 *
 * Save stays off while no tag is ticked, for the same reason the new-group
 * save does — an empty group could only ever empty the grid. An emptied name
 * is not saved either; the group keeps the one it had.
 */
function GroupEditor({
  group,
  tags,
  labels,
  onSave,
  onCancel,
}: {
  group: TagFilterPanelGroup;
  tags: TagFilterPanelTag[];
  labels: Pick<
    TagFilterPanelLabels,
    "editTagsSave" | "cancel" | "editTagsHint" | "renameGroup"
  >;
  onSave: (name: string | null, tagIds: string[] | null) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(group.name);
  const [draft, setDraft] = useState<Set<string>>(() => new Set(group.tagIds));
  const toggle = (id: string) =>
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = () => {
    if (draft.size === 0) return;
    const nextName = name.trim();
    // Kept in the order the tags are listed, so the saved group reads the
    // same way the editor did.
    const nextTags = tags.map((t) => t.id).filter((id) => draft.has(id));
    const sameTags =
      nextTags.length === group.tagIds.length &&
      nextTags.every((id) => group.tagIds.includes(id));
    onSave(
      nextName && nextName !== group.name ? nextName : null,
      sameTags ? null : nextTags,
    );
  };

  return (
    <div className="flex basis-full flex-col gap-2 rounded-lumen-md border border-lumen-border bg-lumen-bg-secondary p-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          // WebKit sends the variant-CONFIRMING Enter with
          // `isComposing: false`, so the flag alone lets the one keypress
          // that matters through (§7).
          if (e.key === "Enter" && !isImeComposing(e)) save();
          if (e.key === "Escape") onCancel();
        }}
        aria-label={labels.renameGroup}
        className={TEXT_FIELD}
      />
      <div
        role="group"
        aria-label={group.name}
        className="flex max-h-48 flex-col gap-0.5 overflow-y-auto"
      >
        {tags.map((tag) => (
          <TagCheckRow
            key={tag.id}
            tag={tag}
            checked={draft.has(tag.id)}
            onToggle={() => toggle(tag.id)}
            showCount={false}
          />
        ))}
      </div>
      {draft.size === 0 && (
        <p className="text-xs text-lumen-text-tertiary">
          {labels.editTagsHint}
        </p>
      )}
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className={OUTLINE_BUTTON}>
          {labels.cancel}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={draft.size === 0}
          className={FILLED_BUTTON}
        >
          {labels.editTagsSave}
        </button>
      </div>
    </div>
  );
}

/*
 * The new-group name field, mounted only once "Save these tags as a group" is
 * pressed, and focused on arrival so the press goes straight to typing.
 */
function NewGroupForm({
  labels,
  onSave,
  onCancel,
}: {
  labels: Pick<TagFilterPanelLabels, "namePlaceholder" | "save" | "cancel">;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    field.current?.focus();
  }, []);
  const canSave = name.trim().length > 0;
  const save = () => {
    if (canSave) onSave(name.trim());
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={field}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !isImeComposing(e)) save();
          if (e.key === "Escape") onCancel();
        }}
        placeholder={labels.namePlaceholder}
        aria-label={labels.namePlaceholder}
        className={cn(TEXT_FIELD, "basis-full")}
      />
      <div className="flex flex-1 items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className={OUTLINE_BUTTON}>
          {labels.cancel}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          className={FILLED_BUTTON}
        >
          {labels.save}
        </button>
      </div>
    </div>
  );
}

export function TagFilterPanel({
  tags,
  selectedTagIds,
  onToggleTag,
  onClear,
  groups,
  onSaveGroup,
  onApplyGroup,
  onReleaseGroup,
  onUpdateGroupTags,
  onRenameGroup,
  onDeleteGroup,
  onClose,
  tagsLoading = false,
  labels,
  className,
}: TagFilterPanelProps) {
  // One draft open at a time: two open editors would make it unclear which
  // Save the user meant.
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [naming, setNaming] = useState(false);
  const selected = new Set(selectedTagIds);
  const hasTicks = selected.size > 0;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {tagsLoading ? (
        <div>
          <p role="status" className="sr-only">
            {labels.tagsLoading}
          </p>
          <SkeletonList rows={4} rowHeight={28} gap={6} />
        </div>
      ) : tags.length === 0 ? (
        <p className="text-sm text-lumen-text-secondary">{labels.noTags}</p>
      ) : (
        <div
          role="group"
          aria-label={labels.tagsLabel}
          className="flex max-h-56 flex-col gap-0.5 overflow-y-auto"
        >
          {tags.map((tag) => (
            <TagCheckRow
              key={tag.id}
              tag={tag}
              checked={selected.has(tag.id)}
              onToggle={() => onToggleTag(tag.id)}
              showCount
            />
          ))}
        </div>
      )}

      {/*
       * Clear (+ Close on narrow). On wide it sits right under the ticks it
       * clears; on narrow it moves to the foot of the panel beside Close, where
       * the thumb already is (the proposal's mobile frame). The move is
       * `order`, not a second copy, so there is one Clear in the tree.
       */}
      <div className="flex items-center gap-2 max-md:order-last max-md:border-t max-md:border-lumen-border max-md:pt-2">
        <button
          type="button"
          onClick={onClear}
          disabled={!hasTicks}
          className={cn(
            "rounded-lumen-sm px-1 py-0.5 text-sm font-medium text-lumen-accent transition-colors hover:text-lumen-accent-hover max-md:min-h-11",
            "disabled:cursor-not-allowed disabled:text-lumen-text-tertiary",
            FOCUS_RING_TIGHT,
          )}
        >
          {labels.clear}
        </button>
        <div className="flex-1" />
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "md:hidden rounded-lumen-md bg-lumen-bg-secondary px-4 text-sm font-semibold text-lumen-text transition-colors hover:bg-lumen-hover min-h-11",
              FOCUS_RING_TIGHT,
            )}
          >
            {labels.close}
          </button>
        )}
      </div>

      <section className="flex flex-col gap-1.5 border-t border-lumen-border pt-3">
        <h3 className={SECTION_HEADING}>{labels.groupsHeading}</h3>
        {groups.length === 0 ? (
          <p className="text-sm text-lumen-text-secondary">
            {labels.groupsEmpty}
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {groups.map((group) => {
              const empty = group.tagNames.length === 0;
              const editing = editingGroupId === group.id;
              return (
                <li key={group.id} className="flex flex-wrap items-center gap-1">
                  {/* The row IS the apply: one press narrows the grid to the
                      group, and the lit row takes it off again (#2142's
                      Release, folded into the same press). */}
                  <button
                    type="button"
                    aria-pressed={group.active}
                    onClick={() =>
                      group.active ? onReleaseGroup() : onApplyGroup(group.id)
                    }
                    disabled={empty}
                    title={empty ? undefined : group.tagNames.join(" / ")}
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-2.5 rounded-lumen-md px-2 py-1.5 text-left text-sm transition-colors max-md:min-h-11",
                      FOCUS_RING_TIGHT,
                      group.active
                        ? "bg-lumen-accent-subtle font-medium text-lumen-accent"
                        : "text-lumen-text hover:bg-lumen-hover",
                      "disabled:cursor-not-allowed disabled:text-lumen-text-tertiary disabled:hover:bg-transparent",
                    )}
                  >
                    <Layers
                      aria-hidden
                      className={cn(
                        "size-4 shrink-0",
                        group.active ? "text-lumen-accent" : "text-lumen-text-secondary",
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate">{group.name}</span>
                    {group.active && (
                      <Check
                        aria-hidden
                        strokeWidth={2.5}
                        className="size-4 shrink-0 text-lumen-accent"
                      />
                    )}
                  </button>
                  <IconButton
                    icon={<Pencil aria-hidden className="size-4" />}
                    label={group.editLabel}
                    aria-expanded={editing}
                    onClick={() => {
                      setNaming(false);
                      setEditingGroupId(editing ? null : group.id);
                    }}
                    className={ROW_ICON}
                  />
                  <IconButton
                    icon={<Trash2 aria-hidden className="size-4" />}
                    label={group.deleteLabel}
                    onClick={() => onDeleteGroup(group.id)}
                    className={ROW_ICON}
                  />
                  {empty && (
                    <p className="basis-full pl-9 text-xs text-lumen-text-tertiary">
                      {labels.groupEmpty}
                    </p>
                  )}
                  {editing && (
                    <GroupEditor
                      group={group}
                      tags={tags}
                      labels={labels}
                      onSave={(name, tagIds) => {
                        if (name !== null) onRenameGroup(group.id, name);
                        if (tagIds !== null)
                          onUpdateGroupTags(group.id, tagIds);
                        setEditingGroupId(null);
                      }}
                      onCancel={() => setEditingGroupId(null)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-1.5">
          {naming && hasTicks ? (
            <NewGroupForm
              labels={labels}
              onSave={(name) => {
                onSaveGroup(name);
                setNaming(false);
              }}
              onCancel={() => setNaming(false)}
            />
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setEditingGroupId(null);
                  setNaming(true);
                }}
                disabled={!hasTicks}
                className={cn(
                  OUTLINE_BUTTON,
                  "inline-flex items-center gap-1.5 font-normal",
                  "disabled:cursor-not-allowed disabled:text-lumen-text-tertiary disabled:hover:bg-transparent",
                )}
              >
                <Plus aria-hidden className="size-4 shrink-0" />
                {labels.saveCurrent}
              </button>
              {!hasTicks && (
                <p className="mt-1 text-xs text-lumen-text-tertiary">
                  {labels.saveHint}
                </p>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
