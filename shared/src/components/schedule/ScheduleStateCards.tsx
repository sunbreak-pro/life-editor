import type { ReactNode } from "react";

/*
 * The calendar's three status surfaces (#296) — "loading", "could not load",
 * and the quiet retry banner that rides above a calendar which still has rows
 * on it. Lifted out of CalendarTab by #889, where they stood as three consts
 * read from both layout branches.
 *
 * What did NOT come along is the decision between them. Which surface is
 * right is a fact about the host's data: a range-fetch failure with stale
 * items on screen degrades to the banner rather than blanking a populated
 * calendar, because a wiped grid reads as "my items vanished" over what is
 * usually a transient error. These components know how to say the three
 * things; which one is true is the host's answer.
 *
 * Pure presentation (CLAUDE.md §3.1 / §6.4): no DataService, no
 * useTranslation. Copy is injected already translated, the retry is an
 * injected callback, lumen-* tokens only (§5).
 */

/**
 * Which status surface a layout should draw, and the retry both cards offer.
 *
 * ONE shape for both layouts: the Desktop body and the narrow fold show the
 * same three states, and letting each carry its own booleans is how a pair of
 * hand-listed sets drifts apart — the Calendar's two overlay lists had parted
 * far enough by #889 that Desktop had lost its confirm dialog and every
 * confirmation asked there hung forever.
 */
export interface ScheduleLoadState {
  /** Nothing on screen yet and a fetch in flight. */
  loading: boolean;
  /** The fetch failed with nothing worth keeping — the card, not the banner. */
  error: boolean;
  /** Re-run the range fetch (the host's `reload`). */
  onRetry: () => void;
}

/** The two lines both failure surfaces say, already translated (§6.4). */
export interface ScheduleLoadErrorLabels {
  /** "Could not load" — the same sentence at both sizes. */
  message: string;
  /** The retry button. */
  retry: string;
}

export interface ScheduleLoadingCardProps {
  /** Already-translated "loading" line (§6.4). */
  label: string;
}

/** Nothing to draw yet — the first range fetch is still in flight. */
export function ScheduleLoadingCard({ label }: ScheduleLoadingCardProps) {
  return (
    <div className="rounded-md border border-lumen-border bg-lumen-bg-secondary px-4 py-10 text-center text-sm text-lumen-text-secondary">
      {label}
    </div>
  );
}

export interface ScheduleErrorCardProps {
  labels: ScheduleLoadErrorLabels;
  onRetry: () => void;
}

/** The fetch failed and there is nothing to keep on screen — offer the retry. */
export function ScheduleErrorCard({ labels, onRetry }: ScheduleErrorCardProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-lumen-border bg-lumen-bg-secondary px-4 py-10 text-center">
      <p className="text-sm text-lumen-text-secondary">{labels.message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lumen-md border border-lumen-border-strong px-3 py-1.5 text-sm font-medium text-lumen-text transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
      >
        {labels.retry}
      </button>
    </div>
  );
}

export interface ScheduleBodyFoldProps {
  state: ScheduleLoadState;
  /** The three lines the fold can say, already translated (§6.4). */
  labels: ScheduleLoadErrorLabels & {
    /** "Loading" — the line the first card shows. */
    loading: string;
  };
  /**
   * Wrapper for the CARD states only. Narrow pads and scrolls them (the phone
   * grid runs edge to edge, so the gutter belongs to the cards rather than to
   * the column); Desktop wants them bare. The calendar itself brings its own
   * wrapper either way, which is why this does not apply to `children`.
   */
  cardClassName?: string;
  /** The calendar — drawn only when neither card is. */
  children: ReactNode;
}

/**
 * The fold between the three EXCLUSIVE body states (#889, shared by #1642
 * W11).
 *
 * Both layouts used to spell this chain out for themselves, which is the
 * arrangement that let the Calendar's two overlay lists drift apart before
 * (see the header). Two things it must keep being:
 *
 *   - a CHAIN, not three conditions. `{loading && …}{error && …}` passes every
 *     obvious test and stacks two cards the moment a fetch fails while another
 *     is in flight;
 *   - the BODY only. The chrome (period label, steppers) stays outside it, or
 *     a failed range fetch leaves the retry as the only control on screen —
 *     no way to step to a range that might load.
 */
export function ScheduleBodyFold({
  state,
  labels,
  cardClassName,
  children,
}: ScheduleBodyFoldProps) {
  if (state.loading || state.error) {
    const card = state.loading ? (
      <ScheduleLoadingCard label={labels.loading} />
    ) : (
      <ScheduleErrorCard labels={labels} onRetry={state.onRetry} />
    );
    return cardClassName ? <div className={cardClassName}>{card}</div> : card;
  }
  return <>{children}</>;
}

export interface ScheduleRangeErrorBannerProps {
  labels: ScheduleLoadErrorLabels;
  onRetry: () => void;
}

/**
 * The same failure, said quietly, because the calendar underneath is still
 * populated (#296). Smaller type and a smaller button on purpose: it sits
 * above live content rather than in place of it.
 */
export function ScheduleRangeErrorBanner({
  labels,
  onRetry,
}: ScheduleRangeErrorBannerProps) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 rounded-md border border-lumen-border bg-lumen-bg-secondary px-3 py-2">
      <p className="text-xs text-lumen-text-secondary">{labels.message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lumen-md border border-lumen-border-strong px-2.5 py-1 text-xs font-medium text-lumen-text transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
      >
        {labels.retry}
      </button>
    </div>
  );
}
