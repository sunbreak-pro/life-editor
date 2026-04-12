import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useTranslation } from "react-i18next";
import type { NoteNode } from "../../types/note";
import { aggregateNoteCreationByDay } from "../../utils/analyticsAggregation";

interface NoteCreationTrendProps {
  notes: NoteNode[];
  days: number;
}

export function NoteCreationTrend({ notes, days }: NoteCreationTrendProps) {
  const { t } = useTranslation();

  const data = useMemo(
    () =>
      aggregateNoteCreationByDay(notes, days).map((d) => ({
        date: d.date.substring(5),
        count: d.completedCount,
      })),
    [notes, days],
  );

  return (
    <div>
      <h3 className="text-sm font-semibold text-notion-text mb-3">
        {t("analytics.materials.creationTrend.title")}
      </h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <AreaChart
            data={data}
            margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-notion-border, #e5e5e5)"
            />
            <XAxis
              dataKey="date"
              tick={{
                fontSize: 10,
                fill: "var(--color-notion-text-secondary, #999)",
              }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{
                fontSize: 10,
                fill: "var(--color-notion-text-secondary, #999)",
              }}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-notion-bg, #fff)",
                border: "1px solid var(--color-notion-border, #e5e5e5)",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: number | undefined) => [
                value ?? 0,
                t("analytics.materials.creationTrend.count"),
              ]}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#8b5cf6"
              fill="#8b5cf6"
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
