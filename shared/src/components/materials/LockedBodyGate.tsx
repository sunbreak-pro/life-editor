import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { cn } from "../cn";
import { FOCUS_RING } from "../styleTokens";

export interface LockedBodyGateProps {
  /** Cover `children` with the unlock CTA. */
  locked: boolean;
  /** Already-translated line inside the CTA (§6.4). */
  hint: string;
  /** Ask for the password — the host owns the dialog. */
  onUnlock: () => void;
  /**
   * What the CTA covers. The host decides what that is: since #1763 it hands
   * over a plain spacer while `locked`, because there is no body to hand over.
   */
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
