import { CircleAlert } from "lucide-react";
import { Button } from "./Button";
import { cn } from "./cn";

export interface LoadErrorCardProps {
  /** Already-translated body, e.g. "予定を読み込めませんでした". */
  message: string;
  /** Already-translated button label — usually `t("common.retry")`. */
  retryLabel: string;
  onRetry: () => void;
  /**
   * The retry the user just pressed is still running. Raises the button's
   * busy state (spinner + `retryingLabel`) so a second press cannot stack a
   * second load on the first.
   */
  retrying?: boolean;
  /** Already-translated "…ing" label shown while `retrying`. */
  retryingLabel?: string;
  className?: string;
}

/*
 * LoadErrorCard (#2620) — "this list could not load, try again", the one
 * failure state the schedule / materials / connect screens share.
 *
 * Why not NoticePanel: the surface is the same (danger border, danger-subtle
 * fill, CircleAlert), but NoticePanel paints a heading-less body in the tone's
 * color, and the prototype keeps the body in normal text with the icon alone
 * carrying the danger. It also puts the button on the same row as the copy
 * rather than under it. Bending NoticePanel's `title` rule for one caller
 * would change every other danger band, so the card is its own component on
 * NoticePanel's tokens.
 *
 * Reloading stays with the screen: each one already keys its load on a
 * `reloadTick` (GoalsTodosScreen, WorkScreen), so `onRetry` bumps that tick.
 *
 *   <LoadErrorCard
 *     message={t("scheduleScreen.loadFailed")}
 *     retryLabel={t("common.retry")}
 *     onRetry={() => setReloadTick((n) => n + 1)}
 *   />
 *
 * Pure presentation (§3.1 / §6.4): every string arrives already translated,
 * lumen-* tokens only, opaque surface (§5).
 */
export function LoadErrorCard({
  message,
  retryLabel,
  onRetry,
  retrying = false,
  retryingLabel,
  className,
}: LoadErrorCardProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-center gap-3 rounded-lumen-md border border-lumen-danger bg-lumen-danger-subtle px-3 py-2.5 text-left",
        className,
      )}
    >
      <CircleAlert
        aria-hidden
        className="h-[18px] w-[18px] shrink-0 text-lumen-danger"
      />
      <p className="min-w-0 flex-1 text-sm leading-normal text-lumen-text">
        {message}
      </p>
      <Button
        variant="secondary"
        size="sm"
        // 44px touch floor below the single breakpoint; the Button size table
        // is left alone because Desktop relies on its h-7 (rules/frontend.md).
        className="shrink-0 max-md:min-h-11"
        busy={retrying}
        busyLabel={retryingLabel}
        onClick={onRetry}
      >
        {retryLabel}
      </Button>
    </div>
  );
}
