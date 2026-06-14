import { useEffect, useMemo, useState } from "react";
import {
  ConnectGraphView,
  useTranslation,
  type ConnectGraphLabels,
  type DataService,
} from "@life-editor/shared";
import type {
  NoteNode,
  DailyNode,
  WikiTagUnified,
  WikiTagAssignmentUnified,
  WikiTagConnectionUnified,
} from "@life-editor/shared";

/*
 * Connect host shell (W4 · B2). Owns data fetching (it may call the injected
 * DataService — §6.4) and i18n `t`, then injects the resolved data + labels
 * into the pure shared <ConnectGraphView>.
 *
 * CRITICAL: the graph is built from the UNIFIED item-link reads
 * (listNotesUnified / listDailiesUnified / listAllWikiTagsUnified /
 * listAllTagAssignments / listAllTagConnections) — all implemented on
 * Supabase. The legacy note_links / note_connections services are stubs that
 * return [] on web and are deliberately NOT used. Backlinks are derived
 * client-side from the already-fetched connections (no per-select fetch).
 *
 * Keep the call site `<ConnectScreen dataService={ds} />` stable (MainScreen
 * depends on it).
 */
interface ConnectScreenProps {
  dataService: DataService;
}

interface ConnectData {
  notes: NoteNode[];
  dailies: DailyNode[];
  tags: WikiTagUnified[];
  assignments: WikiTagAssignmentUnified[];
  connections: WikiTagConnectionUnified[];
}

const EMPTY_DATA: ConnectData = {
  notes: [],
  dailies: [],
  tags: [],
  assignments: [],
  connections: [],
};

export function ConnectScreen({ dataService }: ConnectScreenProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<ConnectData>(EMPTY_DATA);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [notes, dailies, tags, assignments, connections] =
        await Promise.all([
          dataService.listNotesUnified(),
          dataService.listDailiesUnified(),
          dataService.listAllWikiTagsUnified(),
          dataService.listAllTagAssignments(),
          dataService.listAllTagConnections(),
        ]);
      if (cancelled) return;
      setData({ notes, dailies, tags, assignments, connections });
    })();
    return () => {
      cancelled = true;
    };
  }, [dataService]);

  const labels = useMemo<ConnectGraphLabels>(
    () => ({
      title: t("connect.title"),
      graphEmpty: t("ideas.graphEmpty"),
      reheat: t("connect.graph.reheat"),
      resetView: t("connect.graph.resetView"),
      togglePanel: t("connect.graph.togglePanel"),
      closePanel: t("connect.graph.closePanel"),
      clearFilters: t("connect.graph.clearFilters"),
      noMatch: t("connect.graph.noMatch"),
      search: t("connect.graph.search"),
      nodeTypes: t("connect.graph.nodeTypes"),
      tags: t("connect.graph.tags"),
      localGraph: t("connect.graph.localGraph"),
      display: t("connect.graph.display"),
      forces: t("connect.graph.forces"),
      depth: t("connect.graph.depth"),
      off: t("connect.graph.off"),
      showOrphans: t("connect.graph.showOrphans"),
      showLabels: t("connect.graph.showLabels"),
      repel: t("connect.graph.repel"),
      linkDistance: t("connect.graph.linkDistance"),
      center: t("connect.graph.center"),
      collide: t("connect.graph.collide"),
      selectNodeHint: t("connect.graph.selectNodeHint"),
      typeProject: t("connect.graph.typeProject"),
      typeNote: t("connect.graph.typeNote"),
      typeDaily: t("connect.graph.typeDaily"),
      typeTag: t("connect.graph.typeTag"),
      links: t("connect.graph.links"),
      tagsShort: t("connect.graph.tagsShort"),
      connections: t("connect.graph.connections"),
      backlinksTitle: t("backlinks.title"),
      backlinksEmpty: t("backlinks.empty"),
    }),
    [t],
  );

  return (
    <ConnectGraphView
      notes={data.notes}
      dailies={data.dailies}
      tags={data.tags}
      assignments={data.assignments}
      connections={data.connections}
      labels={labels}
    />
  );
}
