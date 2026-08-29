import { Calendar, ChevronDown, Pin } from "lucide-react";
import { cn } from "../cn";
import { ExcerptListItem } from "./ExcerptListItem";

/*
 * Daily past-entries panel (Materials mini-plan Step 4). The right-hand pane
 * the Daily tab pushes into the shared rightSidebar (Desktop only). Unlike the
 * Todos / Notes detail panels this is always-present content (not selection-
 * driven): a native date picker row and the chronological entry list.
 *
 * #1189 removed the "today / yesterday" pair that used to sit above the picker.
 * Both buttons set the same selected date the picker and the entry rows set, so
 * from the outside they read as a filter — and pressing one on any day but the
 * one it named changed nothing visible in the panel itself.
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
  /** Value for the native date input (YYYY-MM-DD). */
  pickerDate: string;
  /** Already-translated display label for the picker row (e.g. "2026/07/05"). */
  pickerLabel: string;
  /** Already-translated aria-label for the date input (§6.4). */
  datePickerLabel: string;
  onPickDate: (date: string) => void;
  /** Already-translated heading (e.g. "エントリ（3）"). */
  entriesHeading: string;
  entries: DailyEntriesPanelEntry[];
  onSelectEntry: (date: string) => void;
  /** Already-translated aria-label for the pin indicator. */
  pinnedLabel: string;
  className?: string;
}

export function DailyEntriesPanel({
  pickerDate,
  pickerLabel,
  datePickerLabel,
  onPickDate,
  entriesHeading,
  entries,
  onSelectEntry,
  pinnedLabel,
  className,
}: DailyEntriesPanelProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Date picker row — a styled display row with an invisible native
          <input type="date"> overlaid so the OS picker opens on click.
          #1189 took the "today / yesterday" pair off the top of it: the two
          buttons set the same selected date this row does, so on any day but
          today they looked like a filter that did nothing. The card they sat in
          went with them — one control does not need a container. */}
      <div
        className={cn(
          "relative flex h-8 items-center gap-2 rounded-lumen-md border border-lumen-border bg-lumen-bg px-2.5 text-[12.5px] text-lumen-text-secondary",
          "focus-within:outline-none focus-within:ring-2 focus-within:ring-lumen-accent",
        )}
      >
        <Calendar size={13} aria-hidden className="shrink-0" />
        <span className="min-w-0 flex-1 truncate">{pickerLabel}</span>
        <ChevronDown size={12} aria-hidden className="shrink-0" />
        <input
          type="date"
          value={pickerDate}
          onChange={(e) => {
            if (e.target.value) onPickDate(e.target.value);
          }}
          aria-label={datePickerLabel}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </div>

      {/* Entry list. */}
      <div className="flex flex-col gap-1.5">
        <div className="px-0.5 text-xs uppercase tracking-wide text-lumen-text-tertiary">
          {entriesHeading}
        </div>
        {entries.map((entry) => (
          <ExcerptListItem
            key={entry.date}
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
        ))}
      </div>
    </div>
  );
}
