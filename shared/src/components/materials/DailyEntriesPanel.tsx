import { useId, useState, type ReactNode } from "react";
import {
  Calendar,
  CalendarCheck,
  CalendarDays,
  Filter,
  Pin,
  Search,
} from "lucide-react";
import { cn } from "../cn";
import { EmptyState } from "../EmptyState";
import { FOCUS_RING_TIGHT as FOCUS_RING } from "../styleTokens";
import {
  DailyMonthCalendar,
  type DailyMonthCalendarProps,
} from "./DailyMonthCalendar";
import { ExcerptListItem } from "./ExcerptListItem";

/*
 * Daily past-entries panel (Materials mini-plan Step 4). The right-hand pane
 * the Daily tab pushes into the shared rightSidebar (Desktop only). Unlike the
 * Todos / Notes detail panels this is always-present content (not selection-
 * driven): a month calendar and the chronological entry list.
 *
 * #1189 removed the "today / yesterday" pair that used to sit above the picker.
 * Both buttons set the same selected date the picker and the entry rows set, so
 * from the outside they read as a filter — and pressing one on any day but the
 * one it named changed nothing visible in the panel itself.
 *
 * #2588 put a month calendar where the native date picker row was. The row
 * showed one date and nothing else; the calendar shows which days of the month
 * have an entry, and it is still the way to open a day nobody has written yet.
 *
 * #2589 put a row of two buttons under the calendar: "Today", and "Filter",
 * which folds the search and sort controls (the host hands them in, so they
 * stay #2577's own part). Unlike #1189's pair, "Today" sits where the days are
 * picked and goes pale on today, so pressing it always changes something. The
 * sort used to hold the list's top at all times for a setting changed rarely;
 * folded, a dot on the button says the list is narrowed or reordered, which
 * would otherwise be invisible while the controls are shut.
 *
 * Pure presentation, DataService-free (§3.1): every pick / select is a
 * host-injected callback, all copy is already-translated props (§6.4 — no
 * useTranslation here), and date math / label formatting stays host-side.
 * lumen-* tokens only; opaque surfaces (§5).
 */

export interface DailyEntriesPanelEntry {
  /** YYYY-MM-DD — the stable identifier + onSelectEntry payload. */
  date: string;
  /** Already-translated day label (e.g. "7/1（火）"). */
  dayLabel: string;
  /** Optional one-line excerpt of the entry's body. */
  excerpt?: string;
  /** Drives the pin indicator on the row. */
  isPinned?: boolean;
  /** Marks the row as the currently selected date. */
  selected?: boolean;
}

/** The "Today" + "Filter" row under the calendar (#2589). */
export interface DailyEntriesPanelActions {
  /** Already-translated label of the "Today" button. */
  todayLabel: string;
  onToday: () => void;
  /** Today is the open day: the button stays in place, pale and disabled. */
  isToday: boolean;
  /** Already-translated label of the "Filter" button. */
  filterLabel: string;
  /** Already-translated words read out with the dot ("filters on"). */
  filterActiveLabel: string;
  /** A search query or a non-default sort is in effect: draws the dot. */
  filterActive: boolean;
  /** The search + sort controls the "Filter" button opens. */
  filterPanel: ReactNode;
}

export interface DailyEntriesPanelProps {
  /** The month calendar at the top of the panel (#2588), passed through. */
  calendar: DailyMonthCalendarProps;
  /** Omitted → no row under the calendar. */
  actions?: DailyEntriesPanelActions;
  /** Already-translated heading (e.g. "エントリ（3）"). */
  entriesHeading: string;
  entries: DailyEntriesPanelEntry[];
  onSelectEntry: (date: string) => void;
  /** Already-translated aria-label for the pin indicator. */
  pinnedLabel: string;
  /**
   * Already-translated line for an empty list (#1839). Omitted → the list area
   * stays blank, which is what it did before there was anything to say.
   */
  emptyMessage?: string;
  /** True when the list is empty because a filter is narrowing it. */
  searchEmpty?: boolean;
  className?: string;
}

// The pair shares one look; the label makes each wide enough for a thumb, so
// narrow floors the height only (#1840).
const ACTION_BUTTON = cn(
  "inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lumen-md border px-2.5 text-[12.5px] max-md:min-h-11 max-md:text-sm",
  "transition-colors",
  FOCUS_RING,
);
const ACTION_IDLE =
  "border-lumen-border bg-lumen-surface-sunken text-lumen-text-secondary hover:bg-lumen-hover hover:text-lumen-text";

export function DailyEntriesPanel({
  calendar,
  actions,
  entriesHeading,
  entries,
  onSelectEntry,
  pinnedLabel,
  emptyMessage,
  searchEmpty = false,
  className,
}: DailyEntriesPanelProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <DailyMonthCalendar {...calendar} />

      {actions && <PanelActions {...actions} />}

      {/* Entry list. */}
      <div className="flex flex-col gap-1.5">
        <div className="px-0.5 text-xs uppercase tracking-wide text-lumen-text-tertiary">
          {entriesHeading}
        </div>
        {entries.length === 0 && emptyMessage ? (
          /*
           * #1839 — "ENTRIES (0)" over a blank space said nothing about why it
           * was blank. Notes answers the same question in the same place
           * (NotesSidebarList), so the glyph turns on whether a filter is
           * narrowing the list: a magnifier for "nothing matched", a calendar
           * for "nothing here yet".
           */
          <EmptyState
            icon={
              searchEmpty ? <Search aria-hidden /> : <Calendar aria-hidden />
            }
            message={emptyMessage}
          />
        ) : (
          entries.map((entry) => (
            <ExcerptListItem
              key={entry.date}
              // #2590: a day glyph in front of each row, so the list reads as
              // days at a glance. ExcerptListItem keeps the glyph decorative
              // (aria-hidden); the day label is still the row's name.
              leading={
                <CalendarDays
                  size={14}
                  data-testid="daily-entry-icon"
                  aria-hidden
                />
              }
              title={entry.dayLabel}
              excerpt={entry.excerpt}
              selected={entry.selected}
              meta={
                entry.isPinned ? (
                  <Pin
                    size={12}
                    aria-label={pinnedLabel}
                    className="text-lumen-accent"
                  />
                ) : undefined
              }
              onClick={() => onSelectEntry(entry.date)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function PanelActions({
  todayLabel,
  onToday,
  isToday,
  filterLabel,
  filterActiveLabel,
  filterActive,
  filterPanel,
}: DailyEntriesPanelActions) {
  // Local and starts shut, like the sort panel inside it: it answers "I am
  // narrowing the list right now". The dot carries what is in effect.
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onToday}
          disabled={isToday}
          className={cn(
            ACTION_BUTTON,
            ACTION_IDLE,
            "disabled:cursor-default disabled:opacity-50",
            "disabled:hover:bg-lumen-surface-sunken disabled:hover:text-lumen-text-secondary",
          )}
        >
          <CalendarCheck size={13} aria-hidden className="shrink-0" />
          <span className="truncate">{todayLabel}</span>
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          className={cn(
            ACTION_BUTTON,
            open
              ? "border-lumen-accent bg-lumen-accent-subtle text-lumen-accent"
              : ACTION_IDLE,
          )}
        >
          <Filter size={13} aria-hidden className="shrink-0" />
          <span className="truncate">{filterLabel}</span>
          {filterActive && (
            <>
              <span
                data-testid="daily-filter-dot"
                aria-hidden
                className="size-1.5 shrink-0 rounded-lumen-full bg-lumen-accent"
              />
              {/* The space keeps the two words apart in the button's name. */}
              {" "}
              <span className="sr-only">{filterActiveLabel}</span>
            </>
          )}
        </button>
      </div>
      {/* Always in the tree, `hidden` while shut, so `aria-controls` points at
          something in both states and the sort panel keeps its own state. */}
      <div id={panelId} hidden={!open}>
        {filterPanel}
      </div>
    </div>
  );
}
