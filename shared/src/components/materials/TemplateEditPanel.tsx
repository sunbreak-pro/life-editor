import type { ReactNode } from "react";
import { cn } from "../cn";
import { Modal } from "../Modal";
import { FOCUS_RING } from "../styleTokens";

/*
 * Editing one saved template, in the middle of the screen (#1180).
 *
 * The brief was "the same UI/UX as a normal note, with exactly two
 * differences": it is a panel, and it commits through Cancel / Save. So the
 * shape here is deliberately the note detail's — the 28px borderless title
 * heading, the body under it, the reading-column width and the 420px body
 * floor it writes at (#1363), the same card insets — and everything the note
 * detail has that a template must NOT have is simply absent: no tags, no
 * links, no pin, no kebab. A template is a stamp, not an item in the graph
 * (#1047), and hiding those rather than leaving them inert is what keeps that
 * true.
 *
 * WHY BUTTONS AND NOT THE NOTE'S AUTOSAVE. A note is the thing you are working
 * on, so a debounce that lands while you think is right. A template is
 * something you keep, edited over a note you were in the middle of — the trip
 * needs an undo, and "close without saving" is that undo. It also makes the
 * panel dismissable without a write, which a debounce cannot offer.
 *
 * Pure presentation (§3.1 / §6.4): the TipTap body arrives as a slot (TipTap
 * is a web dependency), every mutation is a host callback, all copy is
 * already-translated props.
 */

export interface TemplateEditPanelLabels {
  /** Accessible name of the dialog. */
  panelTitle: string;
  /** Accessible name for the name field. */
  nameLabel: string;
  namePlaceholder: string;
  cancel: string;
  save: string;
}

export interface TemplateEditPanelProps {
  open: boolean;
  /** Draft name — the host owns it, and Cancel throws it away. */
  name: string;
  onNameChange: (value: string) => void;
  /** Host-injected body editor for the template being edited. */
  bodyEditor?: ReactNode;
  /**
   * Measured width of the note column this template is edited over, in CSS px
   * (#1471). Optional: without it the panel keeps the reading token alone,
   * which is what a host with nothing to measure (and jsdom, which has no
   * layout) gets.
   */
  columnWidth?: number | null;
  /** Discard the draft and close. Also the backdrop / Escape route. */
  onCancel: () => void;
  /** Write the draft and close. */
  onSave: () => void;
  labels: TemplateEditPanelLabels;
}

export function TemplateEditPanel({
  open,
  name,
  onNameChange,
  bodyEditor,
  columnWidth,
  onCancel,
  onSave,
  labels,
}: TemplateEditPanelProps) {
  return (
    // Escape and the backdrop both CANCEL. A dialog that discarded on one route
    // and saved on the other would make the safe-looking gesture the lossy one.
    //
    // #1363: sized like the note it edits rather than like a dialog.
    // `max-h-full` caps the panel at the backdrop's box, so a long draft
    // scrolls INSIDE the panel instead of pushing Save off the bottom of the
    // window.
    //
    // #1471 — WHY THE TOKEN ALONE WAS NOT "the same width as a note". The
    // reading token is the width PageContainer hands a `width="reading"` page,
    // and the Materials section is `width="wide"`: the note is as wide as
    // whatever the section column has left after the nav and the right panel,
    // which measured 642px at 1280x800 against this dialog's 818. Nothing
    // static can close that gap — the nav collapses and the right panel is
    // drag-resizable — so the host measures the column and hands it over, and
    // the token stays on as the CEILING through `min()`. Wide screens keep a
    // readable line; the 1280 case now matches the note beside it.
    <Modal
      open={open}
      onClose={onCancel}
      title={labels.panelTitle}
      size="reading"
      maxWidth={
        columnWidth != null
          ? `min(var(--container-lumen-reading), ${columnWidth}px)`
          : undefined
      }
      className="flex max-h-full flex-col"
    >
      {/* The document half — name and body scroll together, the way the page
          scroller carries a note's title and body. The commit row below stays
          OUT of it: the buttons are the one thing a note does not have, so
          they are the one thing that must not scroll away. */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        <input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={labels.namePlaceholder}
          aria-label={labels.nameLabel}
          className={cn(
            // The note detail's "main" title, verbatim — including the
            // `--field-font-size` override that opts a 28px heading out of the
            // mobile 16px field floor (#1134), which would otherwise flatten it
            // to body size on a phone.
            // `shrink-0` is the scroller's doing, not the note's: inside a
            // column that scrolls, a flex item's default shrink would squash
            // the heading and the body instead of letting them run past the
            // bottom edge.
            "min-w-0 shrink-0 border-none bg-transparent px-0 py-0.5 text-[28px] [--field-font-size:28px] font-bold leading-tight tracking-tight text-lumen-text placeholder:text-lumen-text-tertiary",
            FOCUS_RING,
          )}
        />

        {/* 420px — the note detail's "main" body floor verbatim, up from the
            320 this panel used to carry. Same body, same room to write in. */}
        <div className="flex min-w-0 shrink-0 flex-col gap-1 [&_.note-editor]:min-h-[420px]">
          {bodyEditor}
        </div>
      </div>

      <div className="mt-4 flex shrink-0 justify-end gap-2 border-t border-lumen-border pt-3">
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
        <button
          type="button"
          onClick={onSave}
          className={cn(
            "rounded-lumen-md bg-lumen-accent px-3.5 py-1.5 text-sm font-medium text-lumen-on-accent transition-opacity hover:opacity-90",
            FOCUS_RING,
          )}
        >
          {labels.save}
        </button>
      </div>
    </Modal>
  );
}
