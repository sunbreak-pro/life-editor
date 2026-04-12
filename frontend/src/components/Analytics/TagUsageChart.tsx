import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useTranslation } from "react-i18next";
import type { WikiTag, WikiTagAssignment } from "../../types/wikiTag";
import { aggregateTagUsage } from "../../utils/analyticsAggregation";

interface TagUsageChartProps {
  tags: WikiTag[];
  assignments: WikiTagAssignment[];
}

export function TagUsageChart({ tags, assignments }: TagUsageChartProps) {
  const { t } = useTranslation();

  const data = useMemo(
    () =>
      aggregateTagUsage(tags, assignments, 15).map((d) => ({
        name:
          d.tagName.length > 12
            ? d.tagName.substring(0, 12) + "..."
            : d.tagName,
        count: d.count,
        color: d.tagColor,
      })),
    [tags, assignments],
  );

  if (data.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-notion-text mb-3">
        {t("analytics.connect.topTags.title")}
      </h3>
      <div style={{ height: Math.max(160, data.length * 28 + 40) }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-notion-border, #e5e5e5)"
            />
            <XAxis
              type="number"
              tick={{
                fontSize: 10,
                fill: "var(--color-notion-text-secondary, #999)",
              }}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{
                fontSize: 10,
                fill: "var(--color-notion-text-secondary, #999)",
              }}
              width={100}
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
                t("analytics.connect.topTags.count"),
              ]}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
