import { CalendarRange } from "lucide-react";
import { cn } from "./cn";
import { SettingsSegment } from "./SettingsSegment";
import type { DesktopCalendarView } from "../utils/calendarView";

export interface SettingsScheduleProps {
  /** Current initial-view preference. */
  initialView: DesktopCalendarView;
  onInitialViewChange: (view: DesktopCalendarView) => void;
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
  /** Already-translated copy (CLAUDE.md §6.4: no useTranslation here). */
  labels: {
    heading: string;
    description: string;
    initialViewLabel: string;
    day: string;
    week: string;
    month: string;
    hint: string;
    reminderLabel: string;
    reminderDescription: string;
    reminderDefaultLabel: string;
    reminderDefaultHint: string;
    reminderDesktopHint: string;
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
  remindersEnabled,
  onRemindersEnabledChange,
  defaultLeadMinutes,
  onDefaultLeadMinutesChange,
  leadOptions,
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

      <SettingsSegment<DesktopCalendarView>
        label={labels.initialViewLabel}
        value={initialView}
        onChange={onInitialViewChange}
        options={[
          { value: "day", label: labels.day },
          { value: "week", label: labels.week },
          { value: "month", label: labels.month },
        ]}
      />

      <p className="text-sm text-lumen-text-tertiary">{labels.hint}</p>

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
    </div>
  );
}
