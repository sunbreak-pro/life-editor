import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { cn } from "../cn";
import { FOCUS_RING } from "../styleTokens";

export interface LockedBodyGateProps {
  /** Blur the body and cover it with the unlock CTA. */
  locked: boolean;
  /** Already-translated line inside the CTA (§6.4). */
  hint: string;
  /** Ask for the password — the host owns the dialog. */
  onUnlock: () => void;
  /** The note body this wraps. Rendered either way, blurred while locked. */
  children: ReactNode;
}

/*
 * The password lock on a note's BODY (#526). Desktop has always worked this
 * way — title / tags / pin / delete reachable, only the text hidden — while the
 * mobile sheet (#471) swapped the whole detail panel for the unlock CTA, so the
 * same locked note behaved differently depending on the window width. Both
 * surfaces now wrap their editor in this, which is what keeps them from
 * drifting apart again.
 *
 * What this is NOT: security. The blurred text is really in the DOM, and the
 * password itself is still stored in plaintext (docs/known-issues/027). It
 * hides a note from someone glancing at the screen; nothing more. The CTA sits
 * OVER the body rather than replacing it so the layout does not jump when the
 * note unlocks.
 */
export function LockedBodyGate({
  locked,
  hint,
  onUnlock,
  children,
}: LockedBodyGateProps) {
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
      {locked && (
        <button
          type="button"
          onClick={onUnlock}
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lumen-md border border-lumen-border bg-lumen-bg-secondary text-lumen-text",
            FOCUS_RING,
          )}
        >
          <Lock size={20} aria-hidden />
          <span className="text-sm">{hint}</span>
        </button>
      )}
    </div>
  );
}
