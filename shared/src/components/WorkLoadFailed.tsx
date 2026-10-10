import { AlertCircle, RotateCcw } from "lucide-react";
import { cn } from "./cn";

/*
 * The failed-read state of the Mobile Work surfaces (#2054): the target sheet
 * and the drawer history. Claude Design plan A draws their empty and loading
 * states but no failure, and without one a failed read fell through to the
 * empty state — "nothing to link" / "no sessions yet", both false.
 *
 * It keeps the empty state's frame (a 48px disc, a bold line, a small line
 * under it) so the two read as siblings, and adds the one thing the empty
 * state has no use for: a way to read again. The disc's glyph is the only
 * coloured mark, the same way the Trash error card marks its failure.
 *
 * No transition on the button: the Mobile Work screen keeps to the plan's
 * three motions (arc, digits, phase colour). For the same reason a retry in
 * flight shows no spinner — the button goes disabled and says it is loading,
 * which also keeps `aria-busy` from standing alone (rules/frontend.md).
 *
 * The live region holds the two lines only, so the retry button's name is not
 * read out with them.
 */

export interface WorkLoadFailedProps {
  title: string;
  body: string;
  retry: string;
  onRetry: () => void;
  /** A retry is in flight: the button is disabled and reads `retryingLabel`. */
  retrying?: boolean;
  retryingLabel?: string;
  className?: string;
}

export function WorkLoadFailed({
  title,
  body,
  retry,
  onRetry,
  retrying = false,
  retryingLabel,
  className,
}: WorkLoadFailedProps) {
  return (
    <div
      data-testid="work-load-failed"
      className={cn(
        "flex flex-col items-center gap-2 px-6 text-center",
        className,
      )}
    >
      <span className="mb-1 flex h-12 w-12 items-center justify-center rounded-full border border-lumen-border bg-lumen-bg-secondary">
        <AlertCircle
          aria-hidden="true"
          className="size-lumen-icon-lg text-lumen-danger"
        />
      </span>
      <div role="status" className="flex flex-col items-center gap-2">
        <p className="text-sm font-bold text-lumen-text">{title}</p>
        <p className="text-pretty text-xs leading-relaxed text-lumen-text-secondary">
          {body}
        </p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-lumen-md border border-lumen-border-strong bg-lumen-bg px-4 text-sm font-semibold text-lumen-text hover:bg-lumen-hover disabled:cursor-not-allowed disabled:text-lumen-text-tertiary disabled:hover:bg-lumen-bg"
      >
        <RotateCcw aria-hidden="true" className="size-lumen-icon-sm" />
        {retrying && retryingLabel ? retryingLabel : retry}
      </button>
    </div>
  );
}
