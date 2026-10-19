import type { RecordViewChart } from "../../types/recordView";

/*
 * The narrow Records block's small chart (#2264): one kind's last seven days,
 * drawn as bars or a line — the shape the owner picked for that kind on the
 * wide Records tab. A hand-drawn SVG rather than recharts: seven points need
 * no axes or tooltip, and a ResponsiveContainer per line would measure and
 * re-render every row of the block.
 *
 * It is decoration next to the number the line already prints, so it is
 * hidden from assistive tech. Nothing moves: there is no animation to stop
 * under reduced motion.
 */

const WIDTH = 72;
const HEIGHT = 20;
/** Room for the line's stroke and dots at the top and bottom edges. */
const PAD = 2;

export interface RecordSparklineProps {
  /** One value per day, oldest first. Null is a day with nothing to draw. */
  values: readonly (number | null)[];
  chart: RecordViewChart;
}

export function RecordSparkline({
  values,
  chart,
}: RecordSparklineProps): React.JSX.Element {
  const drawn = values.filter((v): v is number => v !== null);
  // Bars stand on zero; a line only needs the spread of its own values.
  const lo = Math.min(...drawn, ...(chart === "bar" ? [0] : []));
  const hi = Math.max(...drawn, ...(chart === "bar" ? [0] : []));
  const span = hi - lo;
  const slot = WIDTH / Math.max(values.length, 1);
  const y = (v: number): number =>
    span === 0 ? HEIGHT / 2 : PAD + ((hi - v) / span) * (HEIGHT - PAD * 2);
  const x = (i: number): number => slot * i + slot / 2;

  return (
    <svg
      data-chart={chart}
      aria-hidden="true"
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="flex-shrink-0"
    >
      {chart === "bar" ? (
        values.map((v, i) => {
          if (v === null) return null;
          const top = Math.min(y(v), y(0));
          return (
            <rect
              key={i}
              x={slot * i + 1}
              y={top}
              width={Math.max(slot - 2, 1)}
              // A zero day keeps a 1px stub so the week still reads as seven.
              height={Math.max(Math.abs(y(0) - y(v)), 1)}
              rx={1}
              fill="var(--color-lumen-accent)"
            />
          );
        })
      ) : (
        <>
          {/* A day without a value is stepped over, as the wide chart does. */}
          <polyline
            points={values
              .map((v, i) => (v === null ? null : `${x(i)},${y(v)}`))
              .filter((p): p is string => p !== null)
              .join(" ")}
            fill="none"
            stroke="var(--color-lumen-accent)"
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {values.map((v, i) =>
            v === null ? null : (
              <circle
                key={i}
                cx={x(i)}
                cy={y(v)}
                r={1.5}
                fill="var(--color-lumen-accent)"
              />
            ),
          )}
        </>
      )}
    </svg>
  );
}
