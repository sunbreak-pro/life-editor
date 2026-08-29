import { cn } from "../cn";
import { FOCUS_RING } from "../styleTokens";

/*
 * The 夕刊 reflection, before the user asks to edit it (#1115).
 *
 * The editor itself has been code-split since #991, but the evening paper
 * MOUNTED it on arrival — and `defaultBriefingTab()` opens the evening paper
 * from 17:00 on the app's default landing section, so the 118 KB gzip TipTap
 * chunk was fetched 1,492 ms into every evening session whether or not anyone
 * meant to write. A boundary only defers the fetch until something renders
 * behind it; this is the something.
 *
 * So the resting state is text. One button holds the whole block, printing the
 * stored lines the way DailyEveningCard already prints them (`eveningBodyLines`
 * → `sectionLines`, the same lossy plain-lines read the Daily card ships), and
 * the press swaps in the real editor. What is lost in the preview is what that
 * renderer has always lost — marks, nesting, block types — which is why it is
 * the RESTING state and not the editing one.
 *
 * A <button>, not a div with a click handler: this is the only way into the
 * editor, so it has to be reachable by keyboard and announce itself to a
 * screen reader as the action it is.
 *
 * Which is also why the accessible name CARRIES THE LINES rather than being
 * just the action. `role=button` prunes its children as presentational, so a
 * bare `aria-label="write today's reflection"` would leave a screen-reader
 * user with no way to hear what they wrote short of pressing it and landing in
 * an editor. KanbanCard solved the same whole-block-button problem the same
 * way (`labels.cardAriaLabel(title, status)`).
 *
 * NO FRAME OF ITS OWN. EveningView already wraps `editorSlot` in a bordered,
 * rounded box, and RichTextEditor draws nothing there either — a border here
 * would be a second inset rule that vanished on press. Same reasoning for
 * `justify-start`: a button centres its content vertically, and the editor
 * top-aligns, so without it the text jumps up on press.
 *
 * `onPrefetch` exists because the swap is the one moment the user is waiting on
 * the chunk. Pointer-enter / focus fires it a beat before the press, so on a
 * warm session the editor is already in the module registry by the time the
 * click lands.
 */

export interface EveningReflectionPreviewProps {
  /** Stored reflection, one entry per paragraph. Empty → the placeholder. */
  lines: readonly string[];
  /** Empty-state text — the editor's own placeholder, so nothing shifts. */
  placeholder: string;
  /**
   * What the press DOES, e.g. "write today's reflection". Prefixed to the
   * lines to build the accessible name — see the header.
   */
  editLabel: string;
  onStartEditing: () => void;
  /** Warm the editor chunk on hover / focus, before the press needs it. */
  onPrefetch?: () => void;
  /** Sizing/padding matching the MOUNTED editor, so the swap does not jump. */
  className?: string;
}

export function EveningReflectionPreview({
  lines,
  placeholder,
  editLabel,
  onStartEditing,
  onPrefetch,
  className,
}: EveningReflectionPreviewProps) {
  return (
    <button
      type="button"
      aria-label={[editLabel, ...lines].join(" ")}
      onClick={onStartEditing}
      onPointerEnter={onPrefetch}
      onFocus={onPrefetch}
      className={cn(
        // A page of text that happens to be pressable, not a control sitting
        // in one: full width, left-aligned, and TOP-aligned so the lines do
        // not shift when the editor takes over.
        "flex w-full flex-col justify-start text-left",
        "rounded-md transition-colors hover:bg-lumen-hover",
        FOCUS_RING,
        className,
      )}
    >
      {lines.length === 0 ? (
        <p className="text-sm leading-relaxed text-lumen-text-secondary">
          {placeholder}
        </p>
      ) : (
        lines.map((line, i) => (
          <p
            key={i}
            className="text-sm leading-relaxed text-lumen-text [&+&]:mt-1"
          >
            {line}
          </p>
        ))
      )}
    </button>
  );
}
