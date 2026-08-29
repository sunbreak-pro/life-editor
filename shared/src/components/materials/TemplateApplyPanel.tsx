import { FileStack } from "lucide-react";
import { cn } from "../cn";
import { Modal } from "../Modal";
import { FOCUS_RING } from "../styleTokens";

/*
 * "Apply a template to this note" (#1181) — pick, then confirm.
 *
 * Templates could be filed but not used from the note you were writing in. The
 * missing half is this one, and it is destructive: applying REPLACES the open
 * note's body.
 *
 * Which is why picking and confirming are two screens rather than one list with
 * a destructive click. Browsing the templates must never be the thing that
 * throws the draft away, so the list only ever moves the dialog forward, and
 * the step that actually writes names the template and says in plain words what
 * happens to what is there now.
 *
 * The note's TITLE is left alone. A template carries a name so it can be found
 * in a list; renaming someone's note because they poured a template into it
 * would be a second edit they did not ask for.
 *
 * Pure presentation (§3.1 / §6.4): applying is a host callback, every string
 * arrives already translated.
 */

/** One row in the picker — the body is fetched only for the one chosen. */
export interface TemplateApplyItem {
  id: string;
  title: string;
}

export interface TemplateApplyPanelLabels {
  /** Dialog name while picking. */
  pickTitle: string;
  /** Dialog name while confirming. */
  confirmTitle: string;
  /** Sits above the list. */
  pickHint: string;
  /** No templates saved yet. */
  empty: string;
  /** Stand-in for a template with a blank name. */
  untitled: string;
  loading: string;
  /**
   * The confirm sentence. A builder rather than a string: it names the
   * template, and where the name sits inside the sentence is the translator's
   * call.
   */
  confirmBody: (templateName: string) => string;
  cancel: string;
  apply: string;
}

export interface TemplateApplyPanelProps {
  open: boolean;
  templates: readonly TemplateApplyItem[];
  loading?: boolean;
  /** The template awaiting confirmation, or null while still picking. */
  pending: TemplateApplyItem | null;
  onPick: (id: string) => void;
  onConfirm: () => void;
  /** Close without writing — also the Escape and backdrop route. */
  onCancel: () => void;
  labels: TemplateApplyPanelLabels;
}

export function TemplateApplyPanel({
  open,
  templates,
  loading = false,
  pending,
  onPick,
  onConfirm,
  onCancel,
  labels,
}: TemplateApplyPanelProps) {
  const cancelButton = (
    <button
      type="button"
      onClick={onCancel}
      className={cn(
        "rounded-lumen-md border border-lumen-border px-3 py-1.5 text-sm text-lumen-text transition-colors hover:bg-lumen-hover",
        FOCUS_RING,
      )}
    >
      {labels.cancel}
    </button>
  );

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={pending ? labels.confirmTitle : labels.pickTitle}
      size="sm"
    >
      {pending ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-lumen-text">
            {labels.confirmBody(pending.title || labels.untitled)}
          </p>
          <div className="flex justify-end gap-2">
            {cancelButton}
            <button
              type="button"
              onClick={onConfirm}
              className={cn(
                "rounded-lumen-md bg-lumen-danger px-3.5 py-1.5 text-sm font-medium text-lumen-on-accent transition-opacity hover:opacity-90",
                FOCUS_RING,
              )}
            >
              {labels.apply}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-lumen-text-secondary">{labels.pickHint}</p>
          {loading ? (
            <p className="text-sm text-lumen-text-secondary">
              {labels.loading}
            </p>
          ) : templates.length === 0 ? (
            <p className="text-sm text-lumen-text-secondary">{labels.empty}</p>
          ) : (
            <ul className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
              {templates.map((tpl) => (
                <li key={tpl.id}>
                  <button
                    type="button"
                    onClick={() => onPick(tpl.id)}
                    className={cn(
                      "flex w-full min-w-0 items-center gap-1.5 rounded-lumen-md px-2 py-2 text-left text-sm text-lumen-text transition-colors hover:bg-lumen-hover",
                      FOCUS_RING,
                    )}
                  >
                    <FileStack size={14} aria-hidden className="shrink-0" />
                    <span className="truncate">
                      {tpl.title || labels.untitled}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-end">{cancelButton}</div>
        </div>
      )}
    </Modal>
  );
}
