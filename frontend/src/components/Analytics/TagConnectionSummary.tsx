import { useTranslation } from "react-i18next";
import { Link2, Unlink, Hash, TrendingUp } from "lucide-react";
import type { TagConnectionStats } from "../../utils/analyticsAggregation";
import { AnalyticsStatCard } from "./AnalyticsStatCard";

interface TagConnectionSummaryProps {
  stats: TagConnectionStats;
}

export function TagConnectionSummary({ stats }: TagConnectionSummaryProps) {
  const { t } = useTranslation();

  return (
    <div>
      <h3 className="text-sm font-semibold text-notion-text mb-3">
        {t("analytics.connect.connections.title")}
      </h3>
      <div className="grid grid-cols-3 gap-3">
        <AnalyticsStatCard
          icon={<Link2 size={18} />}
          label={t("analytics.connect.connections.tagConnections")}
          value={stats.totalTagConnections}
          color="text-blue-500"
        />
        <AnalyticsStatCard
          icon={<Link2 size={18} />}
          label={t("analytics.connect.connections.noteConnections")}
          value={stats.totalNoteConnections}
          color="text-purple-500"
        />
        <AnalyticsStatCard
          icon={<TrendingUp size={18} />}
          label={t("analytics.connect.connections.avgConnections")}
          value={stats.avgConnections}
          color="text-orange-500"
        />
        {stats.mostConnectedTag && (
          <AnalyticsStatCard
            icon={<Hash size={18} />}
            label={t("analytics.connect.connections.mostConnected")}
            value={stats.mostConnectedTag.name}
            color="text-notion-accent"
            subtitle={`${stats.mostConnectedTag.count} connections`}
          />
        )}
        <AnalyticsStatCard
          icon={<Unlink size={18} />}
          label={t("analytics.connect.connections.isolatedTags")}
          value={stats.isolatedTagCount}
          color="text-red-500"
        />
        <AnalyticsStatCard
          icon={<TrendingUp size={18} />}
          label={t("analytics.connect.connections.density")}
          value={`${stats.density}%`}
          color="text-notion-success"
        />
      </div>
    </div>
  );
}
