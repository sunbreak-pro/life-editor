import { useEffect, useMemo, useState } from "react";
import {
  ConnectGraphView,
  WikiTagsUnifiedProvider,
  useWikiTagsUnifiedContext,
  useTranslation,
  type ConnectGraphLabels,
  type DataService,
} from "@life-editor/shared";
import type {
  NoteNode,
  DailyNode,
  WikiTagUnified,
  WikiTagAssignmentUnified,
} from "@life-editor/shared";

/*
 * Connect host shell (W4 · B2; STEP 2 link editing). Owns data fetching (it
 * may call the injected DataService — §6.4) and i18n `t`, then injects the
 * resolved data + labels into the pure shared <ConnectGraphView>.
 *
 * CRITICAL: the graph is built from the UNIFIED item-link reads
 * (listNotesUnified / listDailiesUnified / listAllWikiTagsUnified /
 * listAllTagAssignments). The item↔item `connections` no longer come from a
 * one-shot listAllTagConnections() into local state — they are read from the
 * WikiTagsUnifiedProvider's bulk cache (`allConnections`), so the
 * createItemLink / deleteItemLink mutators wired below update the graph (and
 * its backlinks) automatically without a manual refetch. The legacy
 * note_links / note_connections services are stubs that return [] on web and
 * are deliberately NOT used.
 *
 * Keep the call site `<ConnectScreen dataService={ds} />` stable (MainScreen
 * depends on it). The Provider is mounted here (Connect was previously
 * Provider-free) so the host can consume the unified link cache + mutators.
 */
interface ConnectScreenProps {
  dataService: DataService;
}

export function ConnectScreen({ dataService }: ConnectScreenProps) {
  return (
    <WikiTagsUnifiedProvider dataService={dataService}>
      <ConnectGraphHost dataService={dataService} />
    </WikiTagsUnifiedProvider>
  );
}

/** Static (per-feature) reads that don't change when links are edited. */
interface ConnectStaticData {
  notes: NoteNode[];
  dailies: DailyNode[];
  tags: WikiTagUnified[];
  assignments: WikiTagAssignmentUnified[];
}

const EMPTY_STATIC: ConnectStaticData = {
  notes: [],
  dailies: [],
  tags: [],
  assignments: [],
};

function ConnectGraphHost({ dataService }: ConnectScreenProps) {
  const { t } = useTranslation();
  const wiki = useWikiTagsUnifiedContext();
  const [data, setData] = useState<ConnectStaticData>(EMPTY_STATIC);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [notes, dailies, tags, assignments] = await Promise.all([
        dataService.listNotesUnified(),
        dataService.listDailiesUnified(),
        dataService.listAllWikiTagsUnified(),
        dataService.listAllTagAssignments(),
      ]);
      if (cancelled) return;
      setData({ notes, dailies, tags, assignments });
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
      addLink: t("connect.graph.addLink"),
      removeLink: t("connect.graph.removeLink"),
      linkTargetPlaceholder: t("connect.graph.linkTargetPlaceholder"),
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
      connections={wiki.allConnections}
      labels={labels}
      onCreateLink={(fromId, toId) => {
        void wiki
          .createItemLink(fromId, toId)
          .catch((err) => console.error("createItemLink failed", err));
      }}
      onDeleteLink={(linkId) => {
        void wiki
          .deleteItemLink(linkId)
          .catch((err) => console.error("deleteItemLink failed", err));
      }}
    />
  );
}
