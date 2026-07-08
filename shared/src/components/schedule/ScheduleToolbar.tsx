import { ChevronLeft, ChevronRight, Plus, Settings } from "lucide-react";
import { cn } from "../cn";
import { SegmentedControl, type SegmentedOption } from "../SegmentedControl";

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
        className="rounded-lumen-md border border-lumen-border-strong px-3 py-1.5 text-[13px] font-medium text-lumen-text transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
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
      <span className="text-[15px] font-semibold text-lumen-text">
        {periodLabel}
      </span>

      <div className="flex-1" />

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
          className="flex items-center gap-1.5 rounded-lumen-md bg-lumen-accent px-3.5 py-[7px] text-[13px] font-medium text-lumen-on-accent transition-colors hover:bg-lumen-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent focus-visible:ring-offset-2 focus-visible:ring-offset-lumen-bg"
        >
          <Plus aria-hidden className="size-4" />
          {addEventLabel}
        </button>
      )}
    </div>
  );
}
