import { CalendarRange } from "lucide-react";
import { cn } from "./cn";
import { ColorPicker } from "./ColorPicker";
import { SettingsSegment } from "./SettingsSegment";
import type { DesktopCalendarView } from "../utils/calendarView";

export interface SettingsScheduleProps {
  /** Current initial-view preference. */
  initialView: DesktopCalendarView;
  onInitialViewChange: (view: DesktopCalendarView) => void;
  /**
   * False on narrow widths (#1873), where the effective view is pinned to the
   * month grid (#878). The control used to stay pressable there with a hint
   * underneath saying it does nothing; now the card says that once, in
   * `labels.initialViewNarrowNote`, and offers no control. Defaults to true.
   */
  initialViewApplies?: boolean;
  /** Master switch for event reminders (#1374). */
  remindersEnabled: boolean;
  onRemindersEnabledChange: (on: boolean) => void;
  /**
   * What a NEWLY created event gets. Applied at create time and written onto
   * the row — changing it here never re-arms an event that already exists,
   * which is what the hint below has to say out loud.
   */
  defaultLeadMinutes: number;
  onDefaultLeadMinutesChange: (minutes: number) => void;
  /** Already-translated lead-time choices, in the order offered. */
  leadOptions: Array<{ value: number; label: string }>;
  /**
   * The ONE colour every holiday is drawn in (#1626). Shared across all of
   * them by the Issue's rule — the holiday's NAME already tells 敬老の日 from
   * 秋分の日, so per-holiday colours would encode nothing.
   */
  holidayColor: string;
  /** Picking "clear" in the swatch grid restores the default red. */
  onHolidayColorChange: (color: string) => void;
  /** The default, so clearing has something to fall back to. */
  defaultHolidayColor: string;
  /**
   * Whether holidays are drawn on the calendar (#1802). A setting rather than
   * the session filter it used to be: what it hides are days the user did not
   * create and cannot book over, so restoring it cannot make a busy slot look
   * free. The toolbar button stays — both sides read this same pref.
   */
  holidaysShown: boolean;
  onHolidaysShownChange: (shown: boolean) => void;
  /** Already-translated copy (CLAUDE.md §6.4: no useTranslation here). */
  labels: {
    heading: string;
    description: string;
    initialViewLabel: string;
    week: string;
    month: string;
    hint: string;
    /** Shown INSTEAD of the control + hint when `initialViewApplies` is false. */
    initialViewNarrowNote?: string;
    reminderLabel: string;
    reminderDescription: string;
    reminderDefaultLabel: string;
    reminderDefaultHint: string;
    reminderDesktopHint: string;
    holidayHeading: string;
    holidayDescription: string;
    holidayColorLabel: string;
    holidayColorClear: string;
    holidayColorCustom: string;
    holidayVisibleLabel: string;
  };
}

/*
 * Schedule settings card (#1174) — the body of the Settings screen's
 * `schedule` tab. One preference so far: which calendar view the section opens
 * on, previously hardcoded to "week" in useCalendarNav.
 *
 * Pure / props-injected like every other settings card (§6.4): value + setter
 * come from the host (useScheduleInitialViewPref), copy arrives translated,
 * lumen-* tokens only (§5).
 *
 * The hint is not decoration: narrow widths pin the effective view to the month
 * grid (#878), so this choice is what a Desktop-width Schedule opens on and the
 * card has to say so rather than let the setting look inert on a phone.
 */
export function SettingsSchedule({
  initialView,
  onInitialViewChange,
  initialViewApplies = true,
  remindersEnabled,
  onRemindersEnabledChange,
  defaultLeadMinutes,
  onDefaultLeadMinutesChange,
  leadOptions,
  holidayColor,
  onHolidayColorChange,
  defaultHolidayColor,
  holidaysShown,
  onHolidaysShownChange,
  labels,
}: SettingsScheduleProps) {
  return (
    <div className="flex flex-col gap-4" data-section-id="schedule">
      <div className="flex flex-col gap-1">
        <h3 className="flex items-center gap-2 text-base font-semibold text-lumen-text">
          <CalendarRange size={16} className="text-lumen-text-secondary" />
          <span>{labels.heading}</span>
        </h3>
        <p className="text-sm text-lumen-text-secondary">
          {labels.description}
        </p>
      </div>

      {initialViewApplies ? (
        <>
          <SettingsSegment<DesktopCalendarView>
            label={labels.initialViewLabel}
            value={initialView}
            onChange={onInitialViewChange}
            options={[
              { value: "week", label: labels.week },
              { value: "month", label: labels.month },
            ]}
          />

          <p className="text-sm text-lumen-text-tertiary">{labels.hint}</p>
        </>
      ) : (
        labels.initialViewNarrowNote && (
          <p className="text-sm text-lumen-text-tertiary">
            {labels.initialViewNarrowNote}
          </p>
        )
      )}

      {/* Event reminders (#1374). The two hints are load-bearing rather than
          decoration, for the same reason the initial-view hint above is: the
          default applies to events created FROM NOW ON, and the OS half is
          Desktop-only (CLAUDE.md §2). Say both on screen, or the controls
          look inert to someone whose expectation they quietly do not meet. */}
      <div className="flex flex-col gap-3 border-t border-lumen-border pt-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-lumen-text">
            {labels.reminderLabel}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={remindersEnabled}
            aria-label={labels.reminderLabel}
            onClick={() => onRemindersEnabledChange(!remindersEnabled)}
            className={cn(
              "relative h-5 w-9 shrink-0 rounded-full transition-colors",
              remindersEnabled ? "bg-lumen-accent" : "bg-lumen-border-strong",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-4 w-4 rounded-full bg-lumen-on-accent transition-all",
                remindersEnabled ? "right-0.5" : "left-0.5",
              )}
            />
          </button>
        </div>
        <p className="text-sm text-lumen-text-secondary">
          {labels.reminderDescription}
        </p>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-lumen-text">
            {labels.reminderDefaultLabel}
          </span>
          <select
            value={String(defaultLeadMinutes)}
            disabled={!remindersEnabled}
            onChange={(e) => onDefaultLeadMinutesChange(Number(e.target.value))}
            className={cn(
              "w-full rounded-lumen-md border border-lumen-border bg-lumen-bg px-3 py-2 text-sm text-lumen-text",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
              !remindersEnabled && "opacity-55",
            )}
          >
            {leadOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <p className="text-sm text-lumen-text-tertiary">
          {labels.reminderDefaultHint}
        </p>
        <p className="text-sm text-lumen-text-tertiary">
          {labels.reminderDesktopHint}
        </p>
      </div>

      {/* Holidays (#1626, #1802). Which days are holidays comes from the law;
          what is settable is how they are drawn — whether at all, and in
          which colour. Both outlive the session, which is what puts them
          here. The calendar keeps its own toolbar toggle for the first of
          them, reading this same pref, so changing it where you are looking
          at the grid still works. */}
      <div className="flex flex-col gap-3 border-t border-lumen-border pt-4">
        <span className="text-sm font-medium text-lumen-text">
          {labels.holidayHeading}
        </span>
        <p className="text-sm text-lumen-text-secondary">
          {labels.holidayDescription}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-lumen-text">
            {labels.holidayVisibleLabel}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={holidaysShown}
            aria-label={labels.holidayVisibleLabel}
            onClick={() => onHolidaysShownChange(!holidaysShown)}
            className={cn(
              "relative h-5 w-9 shrink-0 rounded-full transition-colors",
              holidaysShown ? "bg-lumen-accent" : "bg-lumen-border-strong",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-4 w-4 rounded-full bg-lumen-on-accent transition-all",
                holidaysShown ? "right-0.5" : "left-0.5",
              )}
            />
          </button>
        </div>
        <div data-holiday-color={holidayColor}>
          <ColorPicker
            current={holidayColor}
            label={labels.holidayColorLabel}
            clearLabel={labels.holidayColorClear}
            customLabel={labels.holidayColorCustom}
            // Clearing means "back to the default", not "no colour": a
            // holiday with no face would be indistinguishable from an event,
            // which is the one thing the shared colour exists to prevent.
            onPick={(color) =>
              onHolidayColorChange(color ?? defaultHolidayColor)
            }
          />
        </div>
      </div>
    </div>
  );
}
