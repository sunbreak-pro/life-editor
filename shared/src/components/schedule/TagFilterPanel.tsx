import { useState } from "react";
import { Check, Trash2 } from "lucide-react";
import { cn } from "../cn";
import { TagHeadingIcon } from "../TagHeadingIcon";
import { isImeComposing } from "../../utils/imeGuard";
import { FOCUS_RING_ON_ACCENT } from "../styleTokens";

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
 * Pure presentation (§3.1 / §6.4): copy arrives translated, every action is a
 * callback, lumen-* tokens only (§5). The only state it owns is the two draft
 * text fields, which are typing buffers rather than app state — the same call
 * the retired CalendarView made.
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
  /** Whether the current tick list is exactly this group. */
  active: boolean;
  /**
   * Already-interpolated aria-label for this row's delete button (e.g.
   * "Delete Work"). Per-row rather than one shared label because the visible
   * name sits in a text INPUT: a screen reader announces an input by its own
   * label, so a generic "Delete group" here would leave the button as the one
   * control in the row that never says which group it acts on.
   */
  deleteLabel: string;
}

export interface TagFilterPanelLabels {
  /** Heading over the checkbox list. */
  tagsHeading: string;
  /** Accessible name for the checkbox group. */
  tagsLabel: string;
  /** Shown instead of the list when no tag exists yet. */
  noTags: string;
  /** Shown instead of the list while the tags are still arriving. */
  tagsLoading: string;
  /** Button that unticks everything. */
  clear: string;
  /** Already-interpolated "N selected". */
  selectedCount: string;
  /** Heading over the saved-group list. */
  groupsHeading: string;
  /** Shown instead of the group list when none exist yet. */
  groupsEmpty: string;
  /** Placeholder for the new-group name field. */
  namePlaceholder: string;
  /** Button that saves the current ticks as a group. */
  save: string;
  /** Hint under the save row while no tag is ticked. */
  saveHint: string;
  /** Button that applies a saved group. */
  apply: string;
  /** aria-label for the per-group rename field. */
  renameGroup: string;
  /** Said in place of the tag list of a group whose tags are all gone. */
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
  onRenameGroup: (groupId: string, name: string) => void;
  onDeleteGroup: (groupId: string) => void;
  /** True until the tag list has landed once (never during a background refetch). */
  tagsLoading?: boolean;
  labels: TagFilterPanelLabels;
  className?: string;
}

const SECTION_HEADING =
  "text-xs font-semibold uppercase tracking-wide text-lumen-text-secondary";

const GHOST_BUTTON =
  "rounded-lumen-md border border-lumen-border-strong px-2 py-0.5 text-xs font-medium text-lumen-text transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent";

const TEXT_FIELD =
  "min-w-0 flex-1 rounded-lumen-md border border-lumen-border bg-lumen-bg px-2 py-1 text-sm text-lumen-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent";

/*
 * The rename field, as its own component so the draft is per row.
 *
 * A rename is NOT sent per keystroke, which is what the calendars ledger this
 * replaced did (`updateCalendar(cal.id, { title: e.target.value })` on every
 * `onChange`). Each of those calls is a version read plus a PATCH, so typing
 * "Work" was eight round trips and four version bumps for one rename — and
 * every one of them a Realtime echo the section refetches on. It commits on
 * blur and on Enter instead, IME-guarded (§7: WebKit sends the
 * variant-CONFIRMING Enter with `isComposing: false`, so the flag alone lets
 * the one keypress that matters through).
 *
 * The draft re-seeds when `name` changes from outside — the optimistic write
 * lands, then the server's row replaces it — so a rejected write puts the old
 * name back in the field rather than leaving the user's text over data that
 * never took.
 */
function GroupNameField({
  name,
  onCommit,
  label,
}: {
  name: string;
  onCommit: (next: string) => void;
  label: string;
}) {
  const [draft, setDraft] = useState(name);
  // Re-seed when the name changes from outside — adjusted during render (the
  // React "information from previous renders" pattern, as in ColorPicker) so
  // the stale value never paints (#586). An effect would be a cascading render
  // and is what `react-hooks/set-state-in-effect` exists to stop.
  const [prevName, setPrevName] = useState(name);
  if (prevName !== name) {
    setPrevName(name);
    setDraft(name);
  }

  const commit = () => {
    const next = draft.trim();
    // An empty name would leave a row with nothing to click; the field snaps
    // back rather than saving a group the user cannot tell apart from another.
    if (!next || next === name) {
      setDraft(name);
      return;
    }
    onCommit(next);
  };

  return (
    <input
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !isImeComposing(e)) commit();
        if (e.key === "Escape") setDraft(name);
      }}
      aria-label={label}
      className={cn(TEXT_FIELD, "min-w-[8rem]")}
    />
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
  onRenameGroup,
  onDeleteGroup,
  tagsLoading = false,
  labels,
  className,
}: TagFilterPanelProps) {
  const [draftName, setDraftName] = useState("");
  const selected = new Set(selectedTagIds);
  const canSave = selected.size > 0 && draftName.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onSaveGroup(draftName.trim());
    setDraftName("");
  };

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h3 className={SECTION_HEADING}>{labels.tagsHeading}</h3>
          <div className="flex-1" />
          {selected.size > 0 && (
            <>
              <span className="text-xs text-lumen-text-secondary">
                {labels.selectedCount}
              </span>
              <button type="button" onClick={onClear} className={GHOST_BUTTON}>
                {labels.clear}
              </button>
            </>
          )}
        </div>

        {tagsLoading ? (
          <p className="text-sm text-lumen-text-secondary">
            {labels.tagsLoading}
          </p>
        ) : tags.length === 0 ? (
          <p className="text-sm text-lumen-text-secondary">{labels.noTags}</p>
        ) : (
          <div
            role="group"
            aria-label={labels.tagsLabel}
            className="flex max-h-64 flex-col gap-0.5 overflow-y-auto"
          >
            {tags.map((tag) => (
              <label
                key={tag.id}
                className="flex cursor-pointer items-center gap-2 rounded-lumen-sm px-1.5 py-1 transition-colors hover:bg-lumen-hover"
              >
                <input
                  type="checkbox"
                  checked={selected.has(tag.id)}
                  onChange={() => onToggleTag(tag.id)}
                  className="size-4 shrink-0 accent-lumen-accent"
                />
                {/* The tag's own glyph, not a colour dot (#1291): the same
                    <TagHeadingIcon> the chips and the Tag hub draw, so a tag
                    is recognisable here by the icon it was given rather than
                    only by a tint that half the tags never set. */}
                <TagHeadingIcon icon={tag.icon} color={tag.color} size={14} />
                <span className="min-w-0 flex-1 truncate text-sm text-lumen-text">
                  {tag.name}
                </span>
                <span className="tabular-nums text-xs text-lumen-text-tertiary">
                  {tag.count}
                </span>
              </label>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isImeComposing(e)) handleSave();
            }}
            placeholder={labels.namePlaceholder}
            className={TEXT_FIELD}
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className={cn(
              "rounded-lumen-md bg-lumen-accent px-3 py-1 text-sm font-medium text-lumen-on-accent transition-colors hover:bg-lumen-accent-hover disabled:cursor-not-allowed disabled:opacity-50",
              FOCUS_RING_ON_ACCENT,
            )}
          >
            {labels.save}
          </button>
        </div>
        {selected.size === 0 && (
          <p className="text-xs text-lumen-text-tertiary">{labels.saveHint}</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className={SECTION_HEADING}>{labels.groupsHeading}</h3>
        {groups.length === 0 ? (
          <p className="text-sm text-lumen-text-secondary">
            {labels.groupsEmpty}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {groups.map((group) => (
              <li
                key={group.id}
                className={cn(
                  "flex flex-wrap items-center gap-2 rounded-lumen-md border p-2",
                  group.active
                    ? "border-lumen-accent bg-lumen-accent-subtle"
                    : "border-lumen-border",
                )}
              >
                {group.active && (
                  <Check
                    aria-hidden
                    className="size-3.5 shrink-0 text-lumen-accent"
                  />
                )}
                <GroupNameField
                  name={group.name}
                  onCommit={(next) => onRenameGroup(group.id, next)}
                  label={labels.renameGroup}
                />
                <span className="min-w-0 basis-full truncate text-xs text-lumen-text-secondary">
                  {group.tagNames.length === 0
                    ? labels.groupEmpty
                    : group.tagNames.join(" / ")}
                </span>
                <button
                  type="button"
                  onClick={() => onApplyGroup(group.id)}
                  disabled={group.tagNames.length === 0}
                  className={cn(
                    GHOST_BUTTON,
                    "disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                >
                  {labels.apply}
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteGroup(group.id)}
                  aria-label={group.deleteLabel}
                  className="flex size-6 items-center justify-center rounded-lumen-sm border border-lumen-border-strong text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
                >
                  <Trash2 aria-hidden className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
