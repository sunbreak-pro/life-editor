import { useId, useState } from "react";
import { Button } from "../Button";
import { Modal } from "../Modal";

/*
 * RepeatScopeDialog (#279) — the Google-Calendar-style "apply to which
 * occurrences?" chooser shown when a routine-derived occurrence is edited or
 * deleted. Centered on every layout (the issue specifies a screen-center
 * panel, so no BottomSheet variant). Pure presentation (§3.1 / §6.4): copy is
 * injected already translated, every answer is a callback; lumen-* tokens
 * only, opaque panel via the shared <Modal>.
 *
 * Two steps (#2567): the scope is picked on a radio and nothing runs until
 * the confirm button is pressed. The three scopes sit next to each other and
 * two of them reach many rows, so a slip of the pointer must not be the write.
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
  /**
   * The question above the radios ("apply to which range?"). It also names
   * the radio group; omitted, the group takes the title's name.
   */
  description?: string;
  thisOnly: string;
  thisAndFuture: string;
  all: string;
  cancel: string;
  /**
   * The confirm button's word, already resolved per mode by the host (Save /
   * Delete). Omitted, the button repeats the title, which names the action.
   */
  confirm?: string;
  /**
   * What this choice costs that undoing it will not give back (#1801).
   * Sits under the "this and following" radio and is read out with it, so
   * the price is in front of the user BEFORE the confirm rather than after.
   *
   * Optional, and attached to one choice rather than to the dialog: the other
   * two scopes reverse cleanly, and a note over all three would say the wrong
   * thing about them. Omitted, nothing is rendered.
   */
  thisAndFutureNote?: string;
}

export interface RepeatScopeDialogProps {
  open: boolean;
  /** Colors the confirm button: "delete" paints it as destructive. */
  mode: "edit" | "delete";
  labels: RepeatScopeDialogLabels;
  /** Fires on the confirm press only, with the radio chosen by then. */
  onChoose: (scope: RepeatScope) => void;
  onClose: () => void;
  /**
   * #2219: already-translated name for a corner close (×), which lands on
   * `onClose` like Cancel. Omitted, there is none.
   */
  closeLabel?: string;
}

/*
 * The dialog's body, split off so the choice lives exactly as long as one
 * opening: Modal drops its children while closed, so every opening starts
 * back on "this only" and a wide scope picked last time is never preselected.
 */
function RepeatScopeForm({
  mode,
  labels,
  onChoose,
  onClose,
}: Pick<RepeatScopeDialogProps, "mode" | "labels" | "onChoose" | "onClose">) {
  const groupName = useId();
  const descriptionId = useId();
  const noteId = useId();
  const [selected, setSelected] = useState<RepeatScope>("this");
  const options: Array<{ scope: RepeatScope; label: string; note?: string }> = [
    { scope: "this", label: labels.thisOnly },
    {
      scope: "future",
      label: labels.thisAndFuture,
      note: labels.thisAndFutureNote,
    },
    { scope: "all", label: labels.all },
  ];
  // Plain buttons rather than a <form>: a form submits on Enter from a radio,
  // and the focus opens on one, so a stray Enter would run the delete.
  return (
    <>
      {labels.description ? (
        <p
          id={descriptionId}
          className="mb-3 text-sm leading-relaxed text-lumen-text-secondary"
        >
          {labels.description}
        </p>
      ) : null}
      <div
        role="radiogroup"
        aria-labelledby={labels.description ? descriptionId : undefined}
        aria-label={labels.description ? undefined : labels.title}
        // Clipped so a row's hover fill keeps to the rounded corners.
        className="divide-y divide-lumen-border overflow-hidden rounded-lumen-md border border-lumen-border"
      >
        {options.map(({ scope, label, note }) => (
          <div key={scope}>
            <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2.5 text-sm text-lumen-text transition-colors hover:bg-lumen-hover max-md:min-h-11">
              <input
                type="radio"
                name={groupName}
                value={scope}
                checked={selected === scope}
                onChange={() => setSelected(scope)}
                // Modal would open on the corner ×, the first control in the
                // panel. The safe radio takes the focus instead, and never the
                // confirm button, which in delete mode is the destructive one.
                autoFocus={scope === "this"}
                aria-describedby={note ? noteId : undefined}
                className="size-4 shrink-0 cursor-pointer rounded-full accent-lumen-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
              />
              <span className="min-w-0">{label}</span>
            </label>
            {note ? (
              // Outside the label, or it would join the radio's name and be
              // read out twice. Indented to the label text past the radio.
              <p
                id={noteId}
                className="pb-2.5 pl-[2.375rem] pr-3 text-xs text-lumen-text-secondary"
              >
                {note}
              </p>
            ) : null}
          </div>
        ))}
      </div>
      {/* Same row as ConfirmDialog's, touch floor included. */}
      <div className="mt-4 flex justify-end gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="max-md:min-h-11"
          onClick={onClose}
        >
          {labels.cancel}
        </Button>
        <Button
          variant={mode === "delete" ? "danger" : "primary"}
          size="sm"
          className="max-md:min-h-11"
          onClick={() => onChoose(selected)}
        >
          {labels.confirm ?? labels.title}
        </Button>
      </div>
    </>
  );
}

export function RepeatScopeDialog({
  open,
  mode,
  labels,
  onChoose,
  onClose,
  closeLabel,
}: RepeatScopeDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={labels.title}
      size="sm"
      closeLabel={closeLabel}
    >
      <RepeatScopeForm
        mode={mode}
        labels={labels}
        onChoose={onChoose}
        onClose={onClose}
      />
    </Modal>
  );
}
