import { OPEN_IN_SCHEDULE_ICON as Icon } from "./itemOpenAction";

/**
 * 「予定で見る」(#2218; the wording and the icon since #2393) — one look for the
 * event editor and the todo detail, the same outlined secondary button the todo
 * detail's convert uses.
 */
export function OpenInScheduleButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      data-open-in-schedule
      onClick={onPress}
      className="flex items-center gap-1.5 self-start rounded-lumen-md border border-lumen-border-strong px-3 py-1.5 text-sm font-medium text-lumen-text transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent max-md:min-h-11"
    >
      <Icon aria-hidden className="size-3.5" />
      {label}
    </button>
  );
}
