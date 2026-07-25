import { Modal } from "../Modal";
import { cn } from "../cn";

/*
 * RepeatScopeDialog (#279) — the Google-Calendar-style "apply to which
 * occurrences?" chooser shown when a routine-derived occurrence is edited or
 * deleted. Centered on every layout (the issue specifies a screen-center
 * panel, so no BottomSheet variant). Pure presentation (§3.1 / §6.4): copy is
 * injected already translated, every choice is a callback; lumen-* tokens
 * only, opaque panel via the shared <Modal>.
 *
 * Scope semantics are the HOST's contract (CalendarTab):
 *   this   — edit: patch this occurrence only / delete: dismiss this day
 *   future — edit: patch template + unedited future rows / delete: detach
 *            the series from this occurrence's date
 *   all    — same as future but spanning past uncompleted rows too / delete:
 *            soft-delete the routine with full cascade (Trash-restorable)
 */

export type RepeatScope = "this" | "future" | "all";

export interface RepeatScopeDialogLabels {
  /** Dialog heading, already resolved per mode by the host. */
  title: string;
  thisOnly: string;
  thisAndFuture: string;
  all: string;
  cancel: string;
}

export interface RepeatScopeDialogProps {
  open: boolean;
  /** Colors the option buttons: "delete" paints the choices as destructive. */
  mode: "edit" | "delete";
  labels: RepeatScopeDialogLabels;
  onChoose: (scope: RepeatScope) => void;
  onClose: () => void;
}

const OPTION_BASE =
  "w-full rounded-lumen-md border py-2.5 text-center text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent";
const OPTION_NEUTRAL =
  "border-lumen-border-strong text-lumen-text hover:bg-lumen-hover";
const OPTION_DANGER =
  "border-lumen-border-strong text-lumen-danger hover:bg-lumen-hover";

export function RepeatScopeDialog({
  open,
  mode,
  labels,
  onChoose,
  onClose,
}: RepeatScopeDialogProps) {
  const optionClass = cn(
    OPTION_BASE,
    mode === "delete" ? OPTION_DANGER : OPTION_NEUTRAL,
  );
  const options: Array<{ scope: RepeatScope; label: string }> = [
    { scope: "this", label: labels.thisOnly },
    { scope: "future", label: labels.thisAndFuture },
    { scope: "all", label: labels.all },
  ];
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={labels.title}
      className="max-w-sm"
    >
      <div className="flex flex-col gap-2">
        {/* Cancel is DOM-first so the Modal's initial focus lands on the safe
            choice (never a destructive option in delete mode); order-last
            keeps it visually at the bottom. */}
        <button
          type="button"
          onClick={onClose}
          className={cn(
            OPTION_BASE,
            "order-last border-transparent text-lumen-text-secondary hover:bg-lumen-hover",
          )}
        >
          {labels.cancel}
        </button>
        {options.map(({ scope, label }) => (
          <button
            key={scope}
            type="button"
            onClick={() => onChoose(scope)}
            className={optionClass}
          >
            {label}
          </button>
        ))}
      </div>
    </Modal>
  );
}
