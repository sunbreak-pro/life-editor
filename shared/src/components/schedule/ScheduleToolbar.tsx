import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Repeat,
  Settings,
} from "lucide-react";
import { cn } from "../cn";
import { SegmentedControl, type SegmentedOption } from "../SegmentedControl";
import { FOCUS_RING_ON_ACCENT } from "../styleTokens";
import { tourAnchor } from "../tour/anchor";
import { TOUR_ANCHORS } from "../tour/anchors";

/*
 * ScheduleToolbar (W8 target-IA) — the Calendar-tab toolbar: Today / ◀▶ /
 * period label on the left; view segmented control + settings gear + primary
 * "add event" button on the right. Pure presentation (§3.1 / §6.4): every
 * label is injected already translated, every action is a callback. lumen-*
 * tokens only (§5).
 */

export interface ScheduleToolbarLabels {
  today: string;
  prev: string;
  next: string;
  /** aria-label / tooltip for the settings gear (calendars modal). */
  openSettings?: string;
  /** Accessible name for the view segmented control. */
  view?: string;
  /** Repeat filter, filter OFF: the action ("Hide repeats"). */
  hideRepeats?: string;
  /**
   * Repeat filter, filter ON: what is currently folded away, count included
   * (e.g. "3 repeats hidden"). The label carries the number because an empty
   * slot on a filtered grid would otherwise read as free time (#466).
   */
  repeatsHidden?: string;
}

export interface ScheduleToolbarProps {
  /** Already-translated current period label (e.g. "2026年7月9日（木）"). */
  periodLabel: string;
  onToday: () => void;
  onPrev: () => void;
  onNext: () => void;
  /** Current view id + options for the segmented control. */
  view: string;
  viewOptions: SegmentedOption[];
  onChangeView: (id: string) => void;
  /**
   * Repeat filter toggle (#466 Step 5-b). Hidden when omitted — Mobile leaves
   * it out, where the single-day list has no scaffolding problem to solve.
   */
  onToggleRepeats?: () => void;
  /** Whether repeat-generated items are currently folded out of the grid. */
  repeatsHidden?: boolean;
  /** Settings gear (calendars modal). Hidden when omitted. */
  onOpenSettings?: () => void;
  /** Primary add-event action. Hidden when omitted. */
  onAddEvent?: () => void;
  /** Already-translated label for the add-event button. */
  addEventLabel: string;
  labels: ScheduleToolbarLabels;
  className?: string;
}

const ICON_BTN =
  "flex size-7 items-center justify-center rounded-lumen-sm border border-lumen-border-strong text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent";

export function ScheduleToolbar({
  periodLabel,
  onToday,
  onPrev,
  onNext,
  view,
  viewOptions,
  onChangeView,
  onToggleRepeats,
  repeatsHidden = false,
  onOpenSettings,
  onAddEvent,
  addEventLabel,
  labels,
  className,
}: ScheduleToolbarProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <button
        type="button"
        onClick={onToday}
        className="rounded-lumen-md border border-lumen-border-strong px-3 py-1.5 text-sm font-medium text-lumen-text transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
      >
        {labels.today}
      </button>
      <div className="flex gap-1">
        <button
          type="button"
          aria-label={labels.prev}
          onClick={onPrev}
          className={ICON_BTN}
        >
          <ChevronLeft aria-hidden className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label={labels.next}
          onClick={onNext}
          className={ICON_BTN}
        >
          <ChevronRight aria-hidden className="size-3.5" />
        </button>
      </div>
      <span className="text-sm font-semibold text-lumen-text">
        {periodLabel}
      </span>

      <div className="flex-1" />

      {onToggleRepeats && (
        // A toggle, not a menu: with one filter there is nothing to choose
        // between, and while it is on the button IS the "N hidden" notice —
        // the state and the way back out sit in the same control.
        <button
          type="button"
          onClick={onToggleRepeats}
          aria-pressed={repeatsHidden}
          className={cn(
            "flex items-center gap-1.5 rounded-lumen-md border px-2.5 py-[7px] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
            repeatsHidden
              ? "border-lumen-accent bg-lumen-accent-subtle text-lumen-accent"
              : "border-lumen-border-strong text-lumen-text-secondary hover:bg-lumen-hover hover:text-lumen-text",
          )}
        >
          <Repeat aria-hidden className="size-3.5" />
          {repeatsHidden ? labels.repeatsHidden : labels.hideRepeats}
        </button>
      )}

      <SegmentedControl
        options={viewOptions}
        value={view}
        onChange={onChangeView}
        label={labels.view}
        className="w-auto"
      />
      {onOpenSettings && (
        <button
          type="button"
          aria-label={labels.openSettings}
          onClick={onOpenSettings}
          className={ICON_BTN}
        >
          <Settings aria-hidden className="size-3.5" />
        </button>
      )}
      {onAddEvent && (
        <button
          type="button"
          onClick={onAddEvent}
          // #1124 tour anchor. The narrow layout's <AddPill> carries the same
          // id — only one of the two layouts is ever mounted, so the tour
          // finds whichever create control this width actually shows.
          {...tourAnchor(TOUR_ANCHORS.scheduleAddEvent)}
          className={cn(
            "flex items-center gap-1.5 rounded-lumen-md bg-lumen-accent px-3.5 py-[7px] text-sm font-medium text-lumen-on-accent transition-colors hover:bg-lumen-accent-hover",
            FOCUS_RING_ON_ACCENT,
          )}
        >
          <Plus aria-hidden className="size-4" />
          {addEventLabel}
        </button>
      )}
    </div>
  );
}
