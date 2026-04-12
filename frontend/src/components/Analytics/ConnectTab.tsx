import { useEffect, useMemo, useState } from "react";
import { Tag, Link2, Hash, Percent } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useWikiTags } from "../../hooks/useWikiTags";
import { useAnalyticsFilter } from "../../context/AnalyticsFilterContext";
import { getDataService } from "../../services";
import type { WikiTagConnection, NoteConnection } from "../../types/wikiTag";
import { computeTagConnectionStats } from "../../utils/analyticsAggregation";
import { AnalyticsStatCard } from "./AnalyticsStatCard";
import { TagUsageChart } from "./TagUsageChart";
import { TagEntityTypeChart } from "./TagEntityTypeChart";
import { TagConnectionSummary } from "./TagConnectionSummary";

export function ConnectTab() {
  const { t } = useTranslation();
  const { tags, assignments } = useWikiTags();
  const { visibleCharts } = useAnalyticsFilter();
  const [tagConnections, setTagConnections] = useState<WikiTagConnection[]>([]);
  const [noteConnections, setNoteConnections] = useState<NoteConnection[]>([]);

  useEffect(() => {
    const ds = getDataService();
    Promise.all([ds.fetchWikiTagConnections(), ds.fetchNoteConnections()]).then(
      ([tc, nc]) => {
        setTagConnections(tc);
        setNoteConnections(nc);
      },
    );
  }, []);

  const stats = useMemo(() => {
    const uniqueEntities = new Set(assignments.map((a) => a.entityId)).size;
    const totalAssignments = assignments.length;

    return {
      totalTags: tags.length,
      totalAssignments,
      uniqueEntities,
      coverageRate: uniqueEntities,
    };
  }, [tags, assignments]);

  const connectionStats = useMemo(
    () =>
      computeTagConnectionStats(tags, tagConnections, noteConnections.length),
    [tags, tagConnections, noteConnections],
  );

  if (tags.length === 0) {
    return (
      <div className="max-w-3xl mx-auto w-full">
        <p className="text-sm text-notion-text-secondary mt-4 text-center">
          {t("analytics.connect.noTags")}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto w-full space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <AnalyticsStatCard
          icon={<Tag size={20} />}
          label={t("analytics.connect.totalTags")}
          value={stats.totalTags}
          color="text-blue-500"
        />
        <AnalyticsStatCard
          icon={<Link2 size={20} />}
          label={t("analytics.connect.totalAssignments")}
          value={stats.totalAssignments}
          color="text-purple-500"
        />
        <AnalyticsStatCard
          icon={<Hash size={20} />}
          label={t("analytics.connect.uniqueEntities")}
          value={stats.uniqueEntities}
          color="text-orange-500"
        />
        <AnalyticsStatCard
          icon={<Percent size={20} />}
          label={t("analytics.connect.connections.tagConnections")}
          value={connectionStats.totalTagConnections}
          color="text-notion-success"
        />
      </div>

      {visibleCharts.has("tagUsageChart") && (
        <TagUsageChart tags={tags} assignments={assignments} />
      )}

      {visibleCharts.has("tagEntityTypeChart") && (
        <TagEntityTypeChart tags={tags} assignments={assignments} />
      )}

      {visibleCharts.has("tagConnectionSummary") && (
        <TagConnectionSummary stats={connectionStats} />
      )}
    </div>
  );
}
