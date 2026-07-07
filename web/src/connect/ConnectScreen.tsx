import { useEffect, useMemo, useState } from "react";
import {
  ConnectGraphView,
  WikiTagsUnifiedProvider,
  useWikiTagsUnifiedContext,
  useToast,
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
  const { showToast } = useToast();
  const wiki = useWikiTagsUnifiedContext();
  const [data, setData] = useState<ConnectStaticData>(EMPTY_STATIC);
  // First-fetch gate: start in a loading state so the empty-graph message can't
  // flash before any data arrives (EMPTY_STATIC would otherwise read as "empty"
  // for one paint). Flipped to false once the initial reads resolve.
  const [loaded, setLoaded] = useState(false);

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
      setLoaded(true);
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
      linkCreateFailed: t("connect.graph.linkCreateFailed"),
      linkDeleteFailed: t("connect.graph.linkDeleteFailed"),
      backlinksTitle: t("backlinks.title"),
      backlinksEmpty: t("backlinks.empty"),
      // Target-IA additions (states / rightSidebar tabs / zoom / mobile).
      graphLoading: t("connect.graph.loading"),
      emptyTitle: t("connect.empty.title"),
      emptyHint: t("connect.empty.hint"),
      // The {{query}} / {{count}} placeholders must survive into the shared
      // component (which does the final .replace with the live value). Feeding
      // the literal placeholder back through i18next round-trips it unchanged.
      noMatchQuery: t("connect.search.noMatch", { query: "{{query}}" }),
      clearSearch: t("connect.search.clear"),
      zoom: t("connect.graph.zoom"),
      fitView: t("connect.graph.resetView"),
      settingsTab: t("connect.sidebar.settingsTab"),
      backlinksTab: t("connect.sidebar.backlinksTab"),
      incomingLinks: t("connect.sidebar.incomingLinks"),
      viewBacklinks: t("connect.graph.viewBacklinks", { count: "{{count}}" }),
      hintKeys: t("connect.graph.hintKeys"),
      mobileLinksTab: t("connect.mobile.linksTab"),
      mobileBacklinksTab: t("connect.mobile.backlinksTab"),
      mobileSettingsTitle: t("connect.mobile.settingsTitle"),
      mobileSearchPlaceholder: t("connect.mobile.searchPlaceholder"),
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
      isLoading={!loaded}
      // Propagate rejection so SelectedNodeCard's runLinkMutation can catch it
      // (it awaits the returned promise) and report via onLinkError. Swallowing
      // here with .catch would make every mutation look successful.
      onCreateLink={async (fromId, toId) => {
        await wiki.createItemLink(fromId, toId);
      }}
      onDeleteLink={async (linkId) => {
        await wiki.deleteItemLink(linkId);
      }}
      // The card reports a create/delete failure with already-translated copy;
      // raise it as a danger toast (mounted app-wide by ToastProvider).
      onLinkError={(message) => showToast("danger", message)}
    />
  );
}
