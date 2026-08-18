import type { ReactNode } from "react";
import { FileStack, Plus, Trash2 } from "lucide-react";
import { isImeComposing } from "../../utils/imeGuard";
import { cn } from "../cn";
import { FIELD, FIELD_LABEL, FOCUS_RING } from "../styleTokens";

/*
 * Note templates (#1047) — the panel, as both widths render it.
 *
 * A template is a note you have not written yet: a name and a body, kept
 * somewhere the note list will not show it, waiting to be poured into a new
 * note. So the surface is deliberately the note detail's shape — name where the
 * title goes, body under it — with the saved templates listed beside it as the
 * navigation.
 *
 * TWO THINGS THE NOTE DETAIL HAS THAT THIS DOES NOT: tags and links. A template
 * is not an item in the graph — it is a stamp — so tagging or linking it would
 * file the STAMP where the user meant to file what the stamp produces. The
 * note created from it takes tags and links normally, which is where they
 * belong. The body editor is injected without the "[[" loader for the same
 * reason, so the affordance is not merely hidden but absent.
 *
 * Pure presentation (§3.1 / §6.4): every mutation is a host callback, every
 * string arrives already translated, and the TipTap body comes in as a slot
 * because TipTap is a web dependency.
 */

/** One row in the template list — the body is fetched only on select. */
export interface NoteTemplateSummary {
  id: string;
  title: string;
}

export interface NoteTemplatePanelLabels {
  /** Caption above the list column. */
  listHeading: string;
  /** List is empty. */
  empty: string;
  /** "New template" button. */
  newTemplate: string;
  /** Accessible name for the name field. */
  nameLabel: string;
  namePlaceholder: string;
  /** Stand-in for a template with a blank name, in the list. */
  untitled: string;
  /** Caption above the body editor. */
  contentLabel: string;
  /** Accessible name for the per-template delete. */
  delete: string;
  /** "Create a note from this template". */
  use: string;
  /** Shown in the editor column while nothing is selected. */
  pickHint: string;
  /** Why there is no tag / link row here. */
  noTagsHint: string;
  loading: string;
}

export interface NoteTemplatePanelProps {
  templates: readonly NoteTemplateSummary[];
  /** null = nothing selected (first open, or the last one was deleted). */
  selectedId: string | null;
  loading?: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onUse: (id: string) => void;
  /** Draft name of the selected template, and where it commits. */
  name: string;
  onNameChange: (value: string) => void;
  onNameCommit: () => void;
  /** Host-injected body editor for the selected template. */
  bodyEditor?: ReactNode;
  labels: NoteTemplatePanelLabels;
  className?: string;
}

export function NoteTemplatePanel({
  templates,
  selectedId,
  loading = false,
  onSelect,
  onCreate,
  onDelete,
  onUse,
  name,
  onNameChange,
  onNameCommit,
  bodyEditor,
  labels,
  className,
}: NoteTemplatePanelProps) {
  return (
    // Column on a phone, two panes once there is room — the list is navigation,
    // and navigation stacked above its target is what the narrow sheet wants.
    <div className={cn("flex flex-col gap-4 md:flex-row", className)}>
      {/* List column */}
      <div className="flex shrink-0 flex-col gap-2 md:w-56">
        <div className="flex items-center justify-between gap-2">
          <span className={FIELD_LABEL}>{labels.listHeading}</span>
          <button
            type="button"
            onClick={onCreate}
            className={cn(
              "inline-flex items-center gap-1 rounded-lumen-md border border-lumen-border px-2 py-1 text-xs text-lumen-text transition-colors hover:bg-lumen-hover",
              FOCUS_RING,
            )}
          >
            <Plus size={14} aria-hidden />
            {labels.newTemplate}
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-lumen-text-secondary">{labels.loading}</p>
        ) : templates.length === 0 ? (
          <p className="text-sm text-lumen-text-secondary">{labels.empty}</p>
        ) : (
          <ul className="flex max-h-64 flex-col gap-0.5 overflow-y-auto md:max-h-[60vh]">
            {templates.map((tpl) => {
              const active = tpl.id === selectedId;
              return (
                <li key={tpl.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onSelect(tpl.id)}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-1.5 rounded-lumen-md px-2 py-1.5 text-left text-sm transition-colors",
                      active
                        ? "bg-lumen-accent-subtle text-lumen-accent"
                        : "text-lumen-text hover:bg-lumen-hover",
                      FOCUS_RING,
                    )}
                  >
                    <FileStack size={14} aria-hidden className="shrink-0" />
                    <span className="truncate">
                      {tpl.title || labels.untitled}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(tpl.id)}
                    aria-label={labels.delete}
                    className={cn(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-lumen-md text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-danger",
                      FOCUS_RING,
                    )}
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Editor column */}
      {selectedId == null ? (
        <p className="flex-1 text-sm text-lumen-text-secondary">
          {labels.pickHint}
        </p>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={FIELD_LABEL}>{labels.nameLabel}</span>
            <input
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              onBlur={onNameCommit}
              // IME guard (§frontend gotcha): the Enter that CONFIRMS a
              // Japanese conversion must not also commit the name.
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isImeComposing(e)) {
                  e.preventDefault();
                  onNameCommit();
                }
              }}
              placeholder={labels.namePlaceholder}
              aria-label={labels.nameLabel}
              className={FIELD}
            />
          </label>

          <div className="flex min-w-0 flex-col gap-1">
            <span className={FIELD_LABEL}>{labels.contentLabel}</span>
            {bodyEditor}
          </div>

          <p className="text-xs text-lumen-text-tertiary">
            {labels.noTagsHint}
          </p>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => onUse(selectedId)}
              className={cn(
                "rounded-lumen-md border border-lumen-border-strong px-3 py-1.5 text-sm font-medium text-lumen-text transition-colors hover:bg-lumen-hover",
                FOCUS_RING,
              )}
            >
              {labels.use}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
