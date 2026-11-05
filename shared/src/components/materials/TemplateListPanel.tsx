import {
  ChevronDown,
  ChevronUp,
  LayoutTemplate,
  Pencil,
  Trash2,
} from "lucide-react";
import { cn } from "../cn";
import { FOCUS_RING } from "../styleTokens";

/*
 * The saved note templates, as a disclosure in the Notes rightSidebar (#1180).
 *
 * Templates used to be reachable only through a modal opened from the note
 * kebab, which meant "what have I saved?" was a question you could only ask by
 * leaving the note you were writing. They belong beside the note list for the
 * same reason Trash does: both are collections of this tab's rows that are not
 * in the main list, and the sidebar is where this tab keeps its navigation.
 *
 * Collapsed by default, so a sidebar that holds several lists still reads as
 * one column rather than competing panels.
 *
 * EDIT IS AN ICON, NOT THE ROW. A template row is not a thing to "open" the way
 * a note row is — there is no reading view for it — so the row itself does not
 * navigate. The pencil says what the only action is.
 *
 * PINNED TO THE BOTTOM, OPENING UPWARD (#2580). At the end of a long note list
 * the heading was only reachable by scrolling past every note, and opening it
 * pushed the rows further down still. The panel now sticks to the bottom edge
 * of the sidebar's scroll well and its rows open above the heading, so the
 * heading stays where the pointer already is. Sticky rather than a fixed
 * flex footer: the well is the shared RightSidebarContents scroller (every
 * section's sidebar and the narrow drawer), and this keeps the change inside
 * the Notes panel. The opaque subsidebar fill is what the list scrolls under.
 *
 * Pure presentation (§3.1 / §6.4): every mutation is a host callback and every
 * string arrives already translated.
 */

/** One row — the body is fetched only when the host opens the editor. */
export interface TemplateListItem {
  id: string;
  title: string;
}

export interface TemplateListPanelLabels {
  /** Disclosure heading, without the count (this panel appends it). */
  heading: string;
  /** No templates saved yet. */
  empty: string;
  /** Stand-in for a template with a blank name. */
  untitled: string;
  /** Accessible name for the per-row edit button. */
  edit: string;
  /** Accessible name for the per-row delete button. */
  delete: string;
  loading: string;
}

export interface TemplateListPanelProps {
  templates: readonly TemplateListItem[];
  /** True until the first read lands. */
  loading?: boolean;
  open: boolean;
  onToggle: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  labels: TemplateListPanelLabels;
  className?: string;
}

export function TemplateListPanel({
  templates,
  loading = false,
  open,
  onToggle,
  onEdit,
  onDelete,
  labels,
  className,
}: TemplateListPanelProps) {
  const heading = (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        "flex w-full items-center gap-2 rounded-lumen-md px-1 py-2 text-[12.5px] text-lumen-text-secondary hover:bg-lumen-hover",
        FOCUS_RING,
      )}
    >
      {/* Points the way the rows open: up while closed, down to fold them. */}
      {open ? (
        <ChevronDown size={13} aria-hidden className="shrink-0" />
      ) : (
        <ChevronUp size={13} aria-hidden className="shrink-0" />
      )}
      <LayoutTemplate
        size={14}
        aria-hidden
        data-testid="template-heading-icon"
        className="shrink-0"
      />
      <span className="truncate">
        {labels.heading}（{templates.length}）
      </span>
    </button>
  );

  return (
    <div
      data-testid="template-list-panel"
      className={cn(
        "sticky bottom-0 z-10 flex-none border-t border-lumen-border bg-lumen-bg-subsidebar pt-1",
        className,
      )}
    >
      {open && (
        <div className="pt-1">
          {loading ? (
            <p className="px-1 text-sm text-lumen-text-secondary">
              {labels.loading}
            </p>
          ) : templates.length === 0 ? (
            <p className="px-1 text-sm text-lumen-text-secondary">
              {labels.empty}
            </p>
          ) : (
            <ul className="max-h-40 space-y-1 overflow-y-auto">
              {templates.map((tpl) => {
                const title = tpl.title || labels.untitled;
                return (
                  <li
                    key={tpl.id}
                    className={cn(
                      "flex items-center justify-between gap-2 px-1 text-sm",
                      // #2032: a hold on a phone selected the name and raised
                      // iOS's callout. Narrow or any pointer that cannot hover
                      // — the same pair the note row's bin is shown under.
                      "max-md:select-none max-md:[-webkit-touch-callout:none]",
                      "[@media(hover:none)]:select-none [@media(hover:none)]:[-webkit-touch-callout:none]",
                    )}
                  >
                    <LayoutTemplate
                      size={14}
                      aria-hidden
                      data-testid="template-row-icon"
                      className="shrink-0 text-lumen-text-tertiary"
                    />
                    <span className="min-w-0 flex-1 truncate text-lumen-text-secondary">
                      {title}
                    </span>
                    <span className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(tpl.id)}
                        aria-label={`${labels.edit}: ${title}`}
                        className={cn(
                          "text-lumen-text-secondary hover:text-lumen-accent",
                          FOCUS_RING,
                        )}
                      >
                        <Pencil size={14} aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(tpl.id)}
                        aria-label={`${labels.delete}: ${title}`}
                        className={cn(
                          "text-lumen-text-secondary hover:text-lumen-danger",
                          FOCUS_RING,
                        )}
                      >
                        <Trash2 size={14} aria-hidden />
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      {heading}
    </div>
  );
}
