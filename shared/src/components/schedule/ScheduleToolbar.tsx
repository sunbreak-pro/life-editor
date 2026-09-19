import {
  ChevronLeft,
  ChevronRight,
  Flag,
  ListFilter,
  Plus,
  Repeat,
} from "lucide-react";
import { cn } from "../cn";
import { SegmentedControl, type SegmentedOption } from "../SegmentedControl";
import { FOCUS_RING_ON_ACCENT } from "../styleTokens";
import { tourAnchor } from "../tour/anchor";
import { TOUR_ANCHORS } from "../tour/anchors";

/*
 * ScheduleToolbar (W8 target-IA) — the Calendar-tab toolbar: Today / ◀▶ /
 * period label on the left; view segmented control + tag-filter button +
 * primary "add event" button on the right. Pure presentation (§3.1 / §6.4):
 * every label is injected already translated, every action is a callback.
 * lumen-* tokens only (§5).
 *
 * #1173 replaced the settings GEAR with a filter icon. The gear opened a
 * calendars ledger whose only job was saving tag filters, so it promised
 * "settings for this screen" and delivered one narrow thing — and, being a
 * gear, it read as the last place to look for a filter. The button now says
 * what it does, and lights up while the grid is narrowed so the state and its
 * way back out are the same control (the same rule the repeat toggle follows).
 */

export interface ScheduleToolbarLabels {
  today: string;
  prev: string;
  next: string;
  /** aria-label / tooltip for the tag-filter button, filter OFF. */
  openFilter?: string;
  /**
   * Same button, filter ON: what is currently narrowing the grid, count
   * included (e.g. "Filtered by 2 tags"). The label carries the number for
   * the #466 reason — an empty slot on a filtered grid reads as free time.
   */
  filterActive?: string;
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
  /** Holiday filter, filter OFF: the action ("Hide holidays"). */
  hideHolidays?: string;
  /**
   * Same button, filter ON: what is folded away, count included — the #466
   * reason applies unchanged (an empty slot must not read as free time).
   */
  holidaysHidden?: string;
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
  /**
   * Holiday filter toggle (#1626), offered beside the repeat one. Hidden when
   * omitted — Mobile leaves both out.
   */
  onToggleHolidays?: () => void;
  /** Whether holidays are currently folded out of the grid. */
  holidaysHidden?: boolean;
  /** Opens the tag-filter panel. Hidden when omitted. */
  onOpenFilter?: () => void;
  /** Whether a tag filter is currently narrowing the grid. */
  filterActive?: boolean;
  /**
   * How many tags the filter is narrowing by (#1639). Drawn as a small badge
   * on the icon's bottom-right corner while it is 1 or more, and not drawn at
   * all at 0 — a "0" on the icon would say the filter is on and empty.
   *
   * The COUNT is tags only: "hide repeats" is its own button with its own
   * count beside this one, so folding it in here would have the same filter
   * counted twice on one toolbar.
   */
  filterCount?: number;
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
  onToggleHolidays,
  holidaysHidden = false,
  onOpenFilter,
  filterActive = false,
  filterCount = 0,
  onAddEvent,
  addEventLabel,
  labels,
  className,
}: ScheduleToolbarProps) {
  return (
    /*
     * #1469: a CSS container, so the row folds on ITS OWN width rather than
     * the viewport's. At 1280 wide the pane is viewport − nav − detail panel −
     * gutters ≈ 680px with the panel open (the default view) and ≈ 990px with
     * it closed; the full-text row needs ≈ 750px in Japanese, so the last item
     * — the primary "add event" button — used to land alone on a second row
     * whenever the panel was open, at exactly the viewport where the closed
     * state fit fine. A `md:` breakpoint cannot tell those two apart; the
     * container can. Below 48rem (`@max-3xl`) the two text buttons keep their
     * icons and drop their words (accessible names stay on `aria-label`), and
     * the gaps tighten one step. The host's `flex-wrap` stays as the fallback
     * for panes narrower than even the compact row.
     */
    <div
      className={cn(
        "@container flex items-center gap-2.5 @max-3xl:gap-1.5",
        className,
      )}
    >
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
      {/* min-w-0 + truncate: the label gives way before anything wraps. */}
      <span className="min-w-0 truncate text-sm font-semibold text-lumen-text">
        {periodLabel}
      </span>

      <div className="flex-1" />

      {onToggleHolidays && (
        /*
         * #1626, beside the repeat toggle rather than inside the tag-filter
         * panel: both fold away a WHOLE KIND of row, while the panel narrows
         * by the user's own tags — and a holiday carries none, so it could
         * not appear there. It stays a toggle for the same reason the repeat
         * one is (below), and it comes FIRST so the two read as one pair with
         * the always-on filters on the right of them.
         *
         * Icon-only on every width. The repeat button's label is load-bearing
         * because it carries a count that a user can otherwise mistake for
         * free time; a holiday is a fact about the day rather than something
         * on it, so its count has no such reading — it rides the accessible
         * name only, and the toolbar keeps the room for the one that needs it.
         */
        <button
          type="button"
          onClick={onToggleHolidays}
          aria-pressed={holidaysHidden}
          aria-label={
            holidaysHidden ? labels.holidaysHidden : labels.hideHolidays
          }
          title={holidaysHidden ? labels.holidaysHidden : labels.hideHolidays}
          data-holiday-filter={holidaysHidden ? "hidden" : "shown"}
          className={cn(
            ICON_BTN,
            holidaysHidden &&
              "border-lumen-accent bg-lumen-accent-subtle text-lumen-accent hover:text-lumen-accent",
          )}
        >
          <Flag aria-hidden className="size-3.5" />
        </button>
      )}

      {onToggleRepeats && (
        // A toggle, not a menu: with one filter there is nothing to choose
        // between, and while it is on the button IS the "N hidden" notice —
        // the state and the way back out sit in the same control.
        <button
          type="button"
          onClick={onToggleRepeats}
          aria-pressed={repeatsHidden}
          aria-label={repeatsHidden ? labels.repeatsHidden : labels.hideRepeats}
          title={repeatsHidden ? labels.repeatsHidden : labels.hideRepeats}
          className={cn(
            "flex items-center gap-1.5 rounded-lumen-md border px-2.5 py-[7px] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
            repeatsHidden
              ? "border-lumen-accent bg-lumen-accent-subtle text-lumen-accent"
              : "border-lumen-border-strong text-lumen-text-secondary hover:bg-lumen-hover hover:text-lumen-text",
          )}
        >
          <Repeat aria-hidden className="size-3.5" />
          {/* #1469: the ACTION ("hide repeats") folds to the icon in a narrow
              pane; the NOTICE ("N hidden") never does — the count is the #466
              point of the button, an empty slot on a filtered grid would
              otherwise read as free time. */}
          <span className={cn(!repeatsHidden && "@max-3xl:hidden")}>
            {repeatsHidden ? labels.repeatsHidden : labels.hideRepeats}
          </span>
        </button>
      )}

      <SegmentedControl
        options={viewOptions}
        value={view}
        onChange={onChangeView}
        label={labels.view}
        className="w-auto"
      />
      {onOpenFilter && (
        <button
          type="button"
          // The count rides the NAME rather than the badge: the badge is
          // aria-hidden, so a screen reader hears "Filtered by 2 tags" once
          // instead of a loose "2" after the button's name (#1242 owns the
          // singular / plural of that sentence).
          aria-label={filterActive ? labels.filterActive : labels.openFilter}
          aria-pressed={filterActive}
          onClick={onOpenFilter}
          className={cn(
            ICON_BTN,
            // `relative` so the badge can hang off the corner; the button is
            // the only positioned ancestor it should read.
            "relative",
            filterActive &&
              "border-lumen-accent bg-lumen-accent-subtle text-lumen-accent hover:text-lumen-accent",
          )}
        >
          <ListFilter aria-hidden className="size-3.5" />
          {filterCount > 0 && (
            <span
              aria-hidden
              data-filter-count={filterCount}
              /*
               * Bottom-right, overhanging the icon by a few pixels so it reads
               * as attached to it rather than as part of the glyph. Opaque
               * accent fill (§5 — no transparency on a surface that has to stay
               * legible over the toolbar), `tabular-nums` so 1 and 2 do not
               * shift the badge's width, and a floor of 1rem so a single digit
               * is still a circle.
               */
              className="absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-lumen-accent px-1 text-[0.625rem] font-semibold leading-none text-lumen-on-accent tabular-nums"
            >
              {filterCount}
            </span>
          )}
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
          // The name lives on aria-label so the icon-only fold (#1469) keeps
          // it; title gives the hover tip the text used to be.
          aria-label={addEventLabel}
          title={addEventLabel}
          className={cn(
            "flex items-center gap-1.5 rounded-lumen-md bg-lumen-accent px-3.5 py-[7px] text-sm font-medium text-lumen-on-accent transition-colors hover:bg-lumen-accent-hover @max-3xl:px-2",
            FOCUS_RING_ON_ACCENT,
          )}
        >
          <Plus aria-hidden className="size-4" />
          <span className="@max-3xl:hidden">{addEventLabel}</span>
        </button>
      )}
    </div>
  );
}
