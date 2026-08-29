import { CalendarRange } from "lucide-react";
import { SettingsSegment } from "./SettingsSegment";
import type { DesktopCalendarView } from "../utils/calendarView";

export interface SettingsScheduleProps {
  /** Current initial-view preference. */
  initialView: DesktopCalendarView;
  onInitialViewChange: (view: DesktopCalendarView) => void;
  /** Already-translated copy (CLAUDE.md §6.4: no useTranslation here). */
  labels: {
    heading: string;
    description: string;
    initialViewLabel: string;
    day: string;
    week: string;
    month: string;
    hint: string;
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
    </div>
  );
}
