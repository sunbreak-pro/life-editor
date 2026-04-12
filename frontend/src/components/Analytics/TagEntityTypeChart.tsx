import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useTranslation } from "react-i18next";
import type { WikiTag, WikiTagAssignment } from "../../types/wikiTag";
import { aggregateTagByEntityType } from "../../utils/analyticsAggregation";

interface TagEntityTypeChartProps {
  tags: WikiTag[];
  assignments: WikiTagAssignment[];
}

export function TagEntityTypeChart({
  tags,
  assignments,
}: TagEntityTypeChartProps) {
  const { t } = useTranslation();

  const data = useMemo(
    () =>
      aggregateTagByEntityType(tags, assignments, 10).map((d) => ({
        name:
          d.tagName.length > 10
            ? d.tagName.substring(0, 10) + "..."
            : d.tagName,
        tasks: d.taskCount,
        notes: d.noteCount,
        memos: d.memoCount,
      })),
    [tags, assignments],
  );

  if (data.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-notion-text mb-3">
        {t("analytics.connect.byEntityType.title")}
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart
            data={data}
            margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-notion-border, #e5e5e5)"
            />
            <XAxis
              dataKey="name"
              tick={{
                fontSize: 10,
                fill: "var(--color-notion-text-secondary, #999)",
              }}
              interval={0}
              angle={-30}
              textAnchor="end"
              height={50}
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
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar
              dataKey="tasks"
              name={t("analytics.connect.byEntityType.task")}
              stackId="a"
              fill="#2563eb"
            />
            <Bar
              dataKey="notes"
              name={t("analytics.connect.byEntityType.note")}
              stackId="a"
              fill="#8b5cf6"
            />
            <Bar
              dataKey="memos"
              name={t("analytics.connect.byEntityType.memo")}
              stackId="a"
              fill="#f59e0b"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
