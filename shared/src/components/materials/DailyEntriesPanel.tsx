import { Calendar, ChevronDown, Pin } from "lucide-react";
import { cn } from "../cn";
import { ExcerptListItem } from "./ExcerptListItem";

/*
 * Daily past-entries panel (Materials mini-plan Step 4). The right-hand pane
 * the Daily tab pushes into the shared rightSidebar (Desktop only). Unlike the
 * Tasks / Notes detail panels this is always-present content (not selection-
 * driven): a "today / yesterday" quick-jump pair, a native date picker row, and
 * the chronological entry list. Pure presentation, DataService-free (§3.1):
 * every jump / pick / select is a host-injected callback, all copy is already-
 * translated props (§6.4 — no useTranslation here), and date math /
 * label formatting stays host-side. lumen-* tokens only; opaque surfaces (§5).
 */

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent";

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
  /** Already-translated "today" toggle label. */
  todayLabel: string;
  /** Already-translated "yesterday" toggle label. */
  yesterdayLabel: string;
  /** Whether the selected date is today (accent-subtle fill). */
  todaySelected: boolean;
  /** Whether the selected date is yesterday. */
  yesterdaySelected: boolean;
  onSelectToday: () => void;
  onSelectYesterday: () => void;
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
  todayLabel,
  yesterdayLabel,
  todaySelected,
  yesterdaySelected,
  onSelectToday,
  onSelectYesterday,
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
  const quickButton = (label: string, active: boolean, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex-1 rounded-lumen-md border px-2 py-1.5 text-center text-[12.5px] font-medium transition-colors",
        active
          ? "border-lumen-accent bg-lumen-accent-subtle font-semibold text-lumen-accent"
          : "border-lumen-border bg-lumen-bg text-lumen-text-secondary hover:bg-lumen-hover",
        FOCUS_RING,
      )}
    >
      {label}
    </button>
  );

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Quick-jump card — today / yesterday split + native date picker. */}
      <div className="flex flex-col gap-2 rounded-lumen-md border border-lumen-border bg-lumen-bg-secondary p-3">
        <div className="flex gap-2">
          {quickButton(todayLabel, todaySelected, onSelectToday)}
          {quickButton(yesterdayLabel, yesterdaySelected, onSelectYesterday)}
        </div>
        {/* Date picker row — a styled display row with an invisible native
            <input type="date"> overlaid so the OS picker opens on click. */}
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
      </div>

      {/* Entry list. */}
      <div className="flex flex-col gap-1.5">
        <div className="px-0.5 text-[11px] uppercase tracking-wide text-lumen-text-tertiary">
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
