import { Calendar, CalendarDays, Pin, Search } from "lucide-react";
import { cn } from "../cn";
import { EmptyState } from "../EmptyState";
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

export interface DailyEntriesPanelProps {
  /** The month calendar at the top of the panel (#2588), passed through. */
  calendar: DailyMonthCalendarProps;
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

export function DailyEntriesPanel({
  calendar,
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
