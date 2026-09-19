import { cn } from "../cn";
import { SegmentedControl, type SegmentedOption } from "../SegmentedControl";
import { TagHeadingIcon } from "../TagHeadingIcon";

/*
 * TodoFilterPanel (#1641) — what the Todo tab's filter button opens.
 *
 * Two axes, read top to bottom in the order they narrow: WHICH LIST (today's
 * todos, the others, or both) and WHICH TAGS. They combine with AND; several
 * tags combine with OR, the same rule the calendar's tag lens follows.
 *
 * Not <TagFilterPanel>, which the calendar opens: that one also owns saved
 * groups, and a group saved from here would be offered to the grid as if it
 * were a calendar lens. What the two share is the RULE for "carries this tag"
 * (scheduleGridFilter's buildTagMemberIds), which is where agreement actually
 * matters.
 *
 * Pure presentation (§3.1 / §6.4): every label arrives translated, every
 * action is a callback, lumen-* tokens only and an opaque panel (§5).
 */

export interface TodoFilterPanelTag {
  id: string;
  name: string;
  /** Optional hex tint from `wiki_tags.color`; tints the row's glyph. */
  color: string | null;
  /** Stored lucide icon name from `wiki_tags.icon`; null → the generic glyph. */
  icon: string | null;
}

export interface TodoFilterPanelLabels {
  /** Accessible name for the panel itself. */
  panel: string;
  /** Heading + accessible name for the list chooser. */
  scopeHeading: string;
  scopeBoth: string;
  scopeToday: string;
  scopeOther: string;
  /** Heading over the tag checkboxes. */
  tagsHeading: string;
  /** Shown instead of the list when the user has no tags yet. */
  noTags: string;
  /** Button that puts every axis back to "no filter". */
  clear: string;
}

export interface TodoFilterPanelProps {
  scope: "both" | "today" | "other";
  onScopeChange: (scope: "both" | "today" | "other") => void;
  tags: TodoFilterPanelTag[];
  selectedTagIds: string[];
  onToggleTag: (tagId: string) => void;
  onClear: () => void;
  /** Whether anything is narrowing the list right now (enables "clear"). */
  active: boolean;
  labels: TodoFilterPanelLabels;
  className?: string;
}

const HEADING =
  "text-xs font-semibold uppercase tracking-wide text-lumen-text-secondary";

export function TodoFilterPanel({
  scope,
  onScopeChange,
  tags,
  selectedTagIds,
  onToggleTag,
  onClear,
  active,
  labels,
  className,
}: TodoFilterPanelProps) {
  const selected = new Set(selectedTagIds);
  const scopeOptions: SegmentedOption[] = [
    { id: "both", label: labels.scopeBoth },
    { id: "today", label: labels.scopeToday },
    { id: "other", label: labels.scopeOther },
  ];
  return (
    <section
      aria-label={labels.panel}
      className={cn(
        "flex flex-col gap-3 rounded-lumen-md border border-lumen-border bg-lumen-bg-secondary p-3",
        className,
      )}
    >
      <div className="flex flex-col gap-1.5">
        <h4 className={HEADING}>{labels.scopeHeading}</h4>
        <SegmentedControl
          options={scopeOptions}
          value={scope}
          onChange={(id) => onScopeChange(id as "both" | "today" | "other")}
          label={labels.scopeHeading}
          // Three short words in a 320px panel — the same fold the detail
          // panel's own tabs needed (#1343).
          singleLineLabels
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <h4 className={HEADING}>{labels.tagsHeading}</h4>
        {tags.length === 0 ? (
          <p className="text-xs text-lumen-text-secondary">{labels.noTags}</p>
        ) : (
          <ul role="list" className="flex flex-col">
            {tags.map((tag) => (
              <li key={tag.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-sm py-1 text-sm text-lumen-text hover:bg-lumen-hover">
                  <input
                    type="checkbox"
                    checked={selected.has(tag.id)}
                    onChange={() => onToggleTag(tag.id)}
                    className="size-4 shrink-0 accent-lumen-accent"
                  />
                  <TagHeadingIcon icon={tag.icon} color={tag.color} size={14} />
                  <span className="min-w-0 flex-1 truncate">{tag.name}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={onClear}
        disabled={!active}
        className={cn(
          "self-start rounded-lumen-md border border-lumen-border-strong px-2 py-0.5 text-xs font-medium text-lumen-text transition-colors",
          "hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
          "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
        )}
      >
        {labels.clear}
      </button>
    </section>
  );
}
