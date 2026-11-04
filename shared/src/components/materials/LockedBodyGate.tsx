import type { ReactNode } from "react";
import { KeyRound, Lock } from "lucide-react";
import { cn } from "../cn";
import { FOCUS_RING } from "../styleTokens";

export interface LockedBodyGateProps {
  /** Cover `children` with the unlock CTA. */
  locked: boolean;
  /** Already-translated line inside the CTA (§6.4). */
  hint: string;
  /**
   * Already-translated label of the "unlock" button drawn under the hint
   * (#2585 —「ロックを解除」). Omitted → no separate button, and the whole
   * cover is the button instead, which is how the gate worked before #2585.
   */
  unlockLabel?: string;
  /** Ask for the password — the host owns the dialog. */
  onUnlock: () => void;
  /**
   * What the CTA covers. The host decides what that is: since #1763 it hands
   * over a plain spacer while `locked`, because there is no body to hand over.
   */
  children: ReactNode;
}

/*
 * Widths of the stand-in lines under the cover (#2585). The gate draws its own
 * "body" because the host's is a blank spacer since #1763 — a blurred blank
 * reads as an empty note, not a hidden one. They are bars, not words: there is
 * no real text to blur (the body is never fetched while locked), and filler
 * copy would be one more string to translate for something no one can read.
 */
const PLACEHOLDER_LINES = ["92%", "78%", "86%", "64%", "88%", "52%"];

/*
 * The password lock on a note's BODY (#526). Desktop has always worked this
 * way — title / tags / pin / delete reachable, only the text hidden — while the
 * mobile sheet (#471) swapped the whole detail panel for the unlock CTA, so the
 * same locked note behaved differently depending on the window width. Both
 * surfaces now wrap their editor in this, which is what keeps them from
 * drifting apart again.
 *
 * WHAT CHANGED IN #1763 (D-20260920-main-1 = A). This file used to say, right
 * here, that it was not security: the blurred text really was in the DOM,
 * fetched with the note and one devtools inspection away. That is fixed at the
 * source instead — a locked note's `content_json` is no longer SELECTed
 * (SupabaseNotesUnifiedReads.getNoteUnified), so the host renders a spacer
 * here and there is nothing behind the blur to find. The blur + `aria-hidden`
 * stay because the host is free to pass a real body once the gate drops, and
 * one component describing both states is what keeps the two surfaces aligned.
 *
 * What it is STILL not: the body is plaintext jsonb in Postgres and the
 * password's hash is next to it, so a DB dump or the owner's JWT reads it
 * (docs/known-issues/027). A locked note is "a memo others should not see",
 * not a credential store.
 *
 * The CTA sits OVER the children rather than replacing them so the box keeps
 * its place in the layout.
 *
 * #2585: a bare box with a lock and one line did not say what to press. The
 * cover now shows blurred stand-in lines with the lock, the line and an
 * explicit "unlock" button over them. A press anywhere on the cover still
 * starts the unlock, as it did when the whole cover was the button — the
 * button is the keyboard's way in and the eye's answer to "what do I press".
 */
export function LockedBodyGate({
  locked,
  hint,
  unlockLabel,
  onUnlock,
  children,
}: LockedBodyGateProps) {
  const coverClass =
    "absolute inset-0 overflow-hidden rounded-lumen-md border border-lumen-border bg-lumen-bg-secondary text-lumen-text";

  // A span rather than a div: in the label-less form it sits inside a
  // <button>, which may only hold phrasing content.
  const placeholder = (
    <span
      data-testid="locked-body-placeholder"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 flex select-none flex-col gap-3 px-6 py-5 blur-[6px]"
    >
      {PLACEHOLDER_LINES.map((width, i) => (
        <span
          key={i}
          // text-tertiary, not border: border is a few levels off the cover's
          // bg-secondary in both themes, and the blur would erase it.
          className="block h-3 shrink-0 rounded-full bg-lumen-text-tertiary"
          style={{ width }}
        />
      ))}
    </span>
  );

  const badge = (
    <>
      <span
        aria-hidden="true"
        className="grid h-10 w-10 place-items-center rounded-full border border-lumen-border bg-lumen-bg text-lumen-text-secondary"
      >
        <Lock size={18} />
      </span>
      <span className="text-sm text-lumen-text-secondary">{hint}</span>
    </>
  );

  const content =
    "relative flex h-full flex-col items-center justify-center gap-3 p-6";

  return (
    <div className="relative">
      <div
        className={
          locked ? "pointer-events-none select-none blur-md" : undefined
        }
        // `locked || undefined` rather than `locked`: the plain boolean emits
        // aria-hidden="false" on an unlocked note, which is inert but reads as
        // a deliberate statement in the a11y tree. Absent is the honest form.
        aria-hidden={locked || undefined}
      >
        {children}
      </div>
      {locked &&
        (unlockLabel ? (
          // The cover's own click is the mouse-only shortcut kept from the
          // whole-cover button; the inner button is what the keyboard and
          // screen readers reach, so the div needs no role of its own.
          <div className={cn(coverClass, "cursor-pointer")} onClick={onUnlock}>
            {placeholder}
            <div className={content}>
              {badge}
              <button
                type="button"
                onClick={(event) => {
                  // The cover would run onUnlock a second time on the bubble.
                  event.stopPropagation();
                  onUnlock();
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lumen-md border border-lumen-border bg-lumen-bg px-3 py-1.5 text-sm font-medium text-lumen-text shadow-lumen-sm hover:bg-lumen-hover",
                  "max-md:min-h-11 max-md:px-4",
                  FOCUS_RING,
                )}
              >
                <KeyRound size={14} aria-hidden="true" />
                {unlockLabel}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onUnlock}
            className={cn(coverClass, FOCUS_RING)}
          >
            {placeholder}
            <span className={content}>{badge}</span>
          </button>
        ))}
    </div>
  );
}
