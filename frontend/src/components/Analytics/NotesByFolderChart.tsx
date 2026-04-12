import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useTranslation } from "react-i18next";
import type { NoteNode } from "../../types/note";
import { aggregateNotesByFolder } from "../../utils/analyticsAggregation";

interface NotesByFolderChartProps {
  notes: NoteNode[];
}

export function NotesByFolderChart({ notes }: NotesByFolderChartProps) {
  const { t } = useTranslation();

  const data = useMemo(
    () =>
      aggregateNotesByFolder(notes).map((d) => ({
        name:
          d.folderId === null
            ? t("analytics.materials.byFolder.noFolder")
            : d.folderName.length > 15
              ? d.folderName.substring(0, 15) + "..."
              : d.folderName,
        count: d.noteCount,
      })),
    [notes, t],
  );

  if (data.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-notion-text mb-3">
        {t("analytics.materials.byFolder.title")}
      </h3>
      <div style={{ height: Math.max(160, data.length * 32 + 40) }}>
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
              width={120}
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
                t("analytics.materials.byFolder.count"),
              ]}
            />
            <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
