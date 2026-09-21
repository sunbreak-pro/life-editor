import { useMemo, useRef, useState, Fragment } from "react";
import type { TimerSession } from "../../types/timer";
import { aggregateByHourAndDay } from "../../utils/analyticsAggregation";
import { isImeComposing } from "../../utils/imeGuard";
import { ChartCard } from "./ChartCard";

export type HeatmapDayKey =
  | "mon"
  | "tue"
  | "wed"
  | "thu"
  | "fri"
  | "sat"
  | "sun";

export interface WorkTimeHeatmapLabels {
  title: string;
  /** Right-aligned meta text (e.g. "時間帯 × 曜日"). */
  meta: string;
  /** Legend endpoints: low → high intensity. */
  less: string;
  more: string;
  days: Record<HeatmapDayKey, string>;
  /** "{minutes} min" — host interpolates. */
  tooltip: (minutes: number) => string;
  /**
   * One cell in words — "Wed 14:00 · 30 min" (#1867). Used for the tooltip and
   * as the cell's accessible name. Optional: without it the cell is described
   * from the parts above (day name + hour + `tooltip`), which are already in
   * the host's language, so a host that has not wired it still reads right.
   */
  cell?: (day: string, hour: number, minutes: number) => string;
}

interface WorkTimeHeatmapProps {
  sessions: TimerSession[];
  labels: WorkTimeHeatmapLabels;
}

const DAY_KEYS: readonly HeatmapDayKey[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];

/*
 * 4-step intensity scale, tokenized (design 1e). The old rgba(34,197,94,…)
 * literals are gone: empty cells sit on the sunken surface, filled cells use
 * the status-done green band at 30% / 60% / 100% opacity. These are literal
 * class strings so Tailwind's @source scan picks them up.
 */
const HEAT_STEPS = [
  "bg-lumen-surface-sunken",
  "bg-lumen-status-done-band/30",
  "bg-lumen-status-done-band/60",
  "bg-lumen-status-done-band",
] as const;

const HOURS_PER_ROW = 24;
const CELL_SELECTOR = "[data-heat-cell]";

function heatStep(minutes: number, maxMinutes: number): string {
  if (minutes === 0 || maxMinutes === 0) return HEAT_STEPS[0];
  const intensity = Math.min(minutes / maxMinutes, 1);
  if (intensity < 0.34) return HEAT_STEPS[1];
  if (intensity < 0.67) return HEAT_STEPS[2];
  return HEAT_STEPS[3];
}

export function WorkTimeHeatmap({
  sessions,
  labels,
}: WorkTimeHeatmapProps): React.JSX.Element {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  const { cells, maxMinutes } = useMemo(() => {
    const raw = aggregateByHourAndDay(sessions);
    const max = Math.max(...raw.map((c) => c.totalMinutes), 1);
    return { cells: raw, maxMinutes: max };
  }, [sessions]);

  /*
   * Keyboard + screen reader access (#1867). The cells were 168 bare divs whose
   * value existed only in a mouse-hover tooltip, so nothing here could be read
   * without a pointer.
   *
   * 168 tab stops would be its own barrier, so the grid is ONE tab stop with a
   * roving tabindex: Tab lands on a cell, the arrow keys (and Home / End) move
   * between cells, Tab leaves. Until a cell has been focused the container
   * holds the tab stop and forwards focus to the first cell.
   *
   * Movement is resolved against the cells' DOM order rather than their day
   * index, so it keeps working whatever order the rows are drawn in.
   */
  const gridRef = useRef<HTMLDivElement>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const describe = (day: string, hour: number, minutes: number): string =>
    labels.cell
      ? labels.cell(day, hour, minutes)
      : `${day} ${hour}:00 · ${labels.tooltip(minutes)}`;

  const showTooltip = (el: HTMLElement, text: string): void => {
    const rect = el.getBoundingClientRect();
    setTooltip({ x: rect.left + rect.width / 2, y: rect.top - 4, text });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (isImeComposing(e)) return;
    const grid = gridRef.current;
    const from = (e.target as HTMLElement).closest<HTMLElement>(CELL_SELECTOR);
    if (!grid || !from) return;
    const all = Array.from(grid.querySelectorAll<HTMLElement>(CELL_SELECTOR));
    const index = all.indexOf(from);
    const rowStart = index - (index % HOURS_PER_ROW);
    let next: number;
    switch (e.key) {
      case "ArrowRight":
        next = Math.min(index + 1, rowStart + HOURS_PER_ROW - 1);
        break;
      case "ArrowLeft":
        next = Math.max(index - 1, rowStart);
        break;
      case "ArrowDown":
        next = index + HOURS_PER_ROW < all.length ? index + HOURS_PER_ROW : index;
        break;
      case "ArrowUp":
        next = index - HOURS_PER_ROW >= 0 ? index - HOURS_PER_ROW : index;
        break;
      case "Home":
        next = rowStart;
        break;
      case "End":
        next = rowStart + HOURS_PER_ROW - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    all[next]?.focus();
  };

  const getCell = (day: number, hour: number) =>
    cells.find((c) => c.dayOfWeek === day && c.hour === hour);

  return (
    <ChartCard title={labels.title} meta={labels.meta}>
      <div className="relative overflow-x-auto">
        <div
          ref={gridRef}
          role="group"
          aria-label={`${labels.title} — ${labels.meta}`}
          // The grid's single tab stop until a cell takes it over (see above).
          tabIndex={activeKey === null ? 0 : -1}
          onFocus={(e) => {
            if (e.target !== e.currentTarget) return;
            e.currentTarget.querySelector<HTMLElement>(CELL_SELECTOR)?.focus();
          }}
          onKeyDown={handleKeyDown}
          className="inline-grid gap-[2px]"
          style={{
            gridTemplateColumns: `28px repeat(24, 1fr)`,
            gridTemplateRows: `16px repeat(7, 1fr)`,
          }}
        >
          {/* Hour labels row */}
          <div />
          {Array.from({ length: 24 }, (_, h) => (
            <div
              key={`h-${h}`}
              className="text-center text-xs leading-4 text-lumen-text-tertiary"
            >
              {h}
            </div>
          ))}

          {/* Day rows */}
          {DAY_KEYS.map((dayKey, dayIndex) => (
            <Fragment key={`row-${dayKey}`}>
              <div className="flex items-center pr-1 text-xs text-lumen-text-tertiary">
                {labels.days[dayKey]}
              </div>
              {Array.from({ length: 24 }, (_, hour) => {
                const cell = getCell(dayIndex, hour);
                const minutes = cell?.totalMinutes ?? 0;
                const cellKey = `${dayIndex}-${hour}`;
                // Day and hour ride in the text itself (#1867): the tooltip
                // used to say "30 min" and leave WHEN to the reader's eye.
                const text = describe(
                  labels.days[dayKey],
                  hour,
                  Math.round(minutes),
                );
                return (
                  <div
                    key={cellKey}
                    data-heat-cell={cellKey}
                    role="img"
                    aria-label={text}
                    tabIndex={activeKey === cellKey ? 0 : -1}
                    className={`h-3.5 w-3.5 min-h-[14px] min-w-[14px] rounded-sm transition-transform hover:scale-125 focus-visible:scale-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-lumen-accent ${heatStep(minutes, maxMinutes)}`}
                    onMouseEnter={(e) => showTooltip(e.currentTarget, text)}
                    onMouseLeave={() => setTooltip(null)}
                    onFocus={(e) => {
                      setActiveKey(cellKey);
                      showTooltip(e.currentTarget, text);
                    }}
                    onBlur={() => setTooltip(null)}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>

        {/* Intensity legend (少ない → 多い) */}
        <div className="mt-3 flex items-center justify-end gap-1.5">
          <span className="text-xs text-lumen-text-tertiary">
            {labels.less}
          </span>
          {HEAT_STEPS.map((step) => (
            <span key={step} className={`h-3 w-3 rounded-sm ${step}`} />
          ))}
          <span className="text-xs text-lumen-text-tertiary">
            {labels.more}
          </span>
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div
            // The cell's aria-label already says this; the bubble is for sight.
            aria-hidden="true"
            className="pointer-events-none fixed z-50 rounded-md border border-lumen-border bg-lumen-bg px-2 py-1 text-xs text-lumen-text shadow-lumen-sm"
            style={{
              left: tooltip.x,
              top: tooltip.y,
              transform: "translate(-50%, -100%)",
            }}
          >
            {tooltip.text}
          </div>
        )}
      </div>
    </ChartCard>
  );
}
