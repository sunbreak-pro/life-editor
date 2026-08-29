import { isImeComposing } from "../../utils/imeGuard";
import { cn } from "../cn";
import { Modal } from "../Modal";
import { FIELD, FIELD_LABEL, FOCUS_RING } from "../styleTokens";

/*
 * "Registered as a template" panel (#1179).
 *
 * The kebab entry no longer OPENS a template workshop — it registers the note
 * you are looking at, in one press. That press has no visible result on its own
 * (the new row lands in a list this panel is not showing), so the confirmation
 * has to say two things: that it happened, and where the thing now lives.
 *
 * The name field sits at the TOP rather than under the message because it is
 * the one thing still worth changing here. The default name is derived from the
 * note ("<title> のテンプレート"), which is right often enough to keep as the
 * default and wrong often enough that renaming should not cost a second trip
 * through the sidebar.
 *
 * Pure presentation (§3.1 / §6.4): the write is the host's, every string
 * arrives already translated, lumen-* tokens only.
 */

export interface TemplateSavedPanelLabels {
  /** Heading — "the template was created". */
  title: string;
  /** Where the new template can be found. */
  hint: string;
  /** Accessible name for the name field. */
  nameLabel: string;
  namePlaceholder: string;
  /** Dismiss button. */
  done: string;
}

export interface TemplateSavedPanelProps {
  open: boolean;
  /** Draft name of the template that was just created. */
  name: string;
  onNameChange: (value: string) => void;
  /** Persist the draft name (blur / Enter). */
  onNameCommit: () => void;
  /** Dismiss — the host commits any pending name first. */
  onClose: () => void;
  labels: TemplateSavedPanelLabels;
}

export function TemplateSavedPanel({
  open,
  name,
  onNameChange,
  onNameCommit,
  onClose,
  labels,
}: TemplateSavedPanelProps) {
  return (
    <Modal open={open} onClose={onClose} title={labels.title} size="sm">
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className={FIELD_LABEL}>{labels.nameLabel}</span>
          <input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            onBlur={onNameCommit}
            // IME guard (§frontend gotcha): the Enter that CONFIRMS a Japanese
            // conversion must not also commit the name.
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

        <p className="text-sm text-lumen-text-secondary">{labels.hint}</p>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "rounded-lumen-md border border-lumen-border-strong px-3 py-1.5 text-sm font-medium text-lumen-text transition-colors hover:bg-lumen-hover",
              FOCUS_RING,
            )}
          >
            {labels.done}
          </button>
        </div>
      </div>
    </Modal>
  );
}
