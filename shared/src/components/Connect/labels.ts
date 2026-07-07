/*
 * Connect copy contract. shared/src/components MUST NOT call useTranslation
 * (CLAUDE.md §6.4) — the host (web ConnectScreen) resolves every key with its
 * own `t` and passes this typed object down. Mirrors the TrashView labels
 * pattern. Every field maps to an existing `connect.*` / `ideas.*` /
 * `backlinks.*` leaf already present in the shared en/ja catalogs.
 */
export interface ConnectGraphLabels {
  /** connect.title — top bar heading */
  title: string;
  /** ideas.graphEmpty — shown when the graph has no nodes at all */
  graphEmpty: string;

  // ---- top bar (connect.graph.*) ----
  reheat: string;
  resetView: string;
  togglePanel: string;
  closePanel: string;
  clearFilters: string;
  noMatch: string;

  // ---- graph states (connect.graph.* / connect.empty.* / connect.search.*) ----
  /** connect.graph.loading — spinner copy shown until the first fetch resolves */
  graphLoading: string;
  /** connect.empty.title — the graph has no nodes at all */
  emptyTitle: string;
  /** connect.empty.hint — how to make connections appear */
  emptyHint: string;
  /** connect.search.noMatch — template with a {{query}} placeholder */
  noMatchQuery: string;
  /** connect.search.clear — clear the active search */
  clearSearch: string;
  /** connect.graph.zoom — aria-label for the zoom read-out pill */
  zoom: string;
  /** connect.graph.fitView — reused resetView (fit graph to viewport) */
  fitView: string;

  // ---- rightSidebar tabs (connect.sidebar.* / connect.graph.viewBacklinks) ----
  /** connect.sidebar.settingsTab — "Graph settings" tab */
  settingsTab: string;
  /** connect.sidebar.backlinksTab — "Backlinks" tab */
  backlinksTab: string;
  /** connect.sidebar.incomingLinks — "Links to this note" section header */
  incomingLinks: string;
  /**
   * connect.graph.viewBacklinks — template "Backlinks {{count}}" for the
   * SelectedNodeCard meta-row link that jumps to the backlinks tab.
   */
  viewBacklinks: string;
  /** connect.graph.hintKeys — keyboard-shortcut footer in the settings tab */
  hintKeys: string;

  // ---- control panel (connect.graph.*) ----
  search: string;
  nodeTypes: string;
  tags: string;
  localGraph: string;
  display: string;
  forces: string;
  depth: string;
  off: string;
  showOrphans: string;
  showLabels: string;
  repel: string;
  linkDistance: string;
  center: string;
  collide: string;
  selectNodeHint: string;
  typeProject: string;
  typeNote: string;
  typeDaily: string;
  typeTag: string;

  // ---- selected node card (connect.graph.*) ----
  links: string;
  tagsShort: string;
  connections: string;

  // ---- link editing (connect.graph.*) ----
  addLink: string;
  removeLink: string;
  linkTargetPlaceholder: string;
  /**
   * connect.graph.linkCreateFailed — failure copy raised as a toast when the
   * wired onCreateLink rejects (e.g. a pasted id that fails the DB write). The
   * card reports it via onLinkError; the host (ConnectScreen) shows the toast.
   * REQUIRED so every host resolves it — hosts that wire link editing must
   * also wire this copy (no silent English fallback).
   */
  linkCreateFailed: string;
  /** connect.graph.linkDeleteFailed — toast copy when onDeleteLink rejects (see linkCreateFailed). */
  linkDeleteFailed: string;

  // ---- backlinks (backlinks.*) ----
  backlinksTitle: string;
  backlinksEmpty: string;

  // ---- Mobile (catalog + type added now; UI wired by the Mobile pass) ----
  /** connect.mobile.linksTab — "Connections" tab on the mobile peek sheet */
  mobileLinksTab: string;
  /** connect.mobile.backlinksTab — "Backlinks" tab on the mobile peek sheet */
  mobileBacklinksTab: string;
  /** connect.mobile.settingsTitle — title of the mobile settings bottom sheet */
  mobileSettingsTitle: string;
  /** connect.mobile.searchPlaceholder — mobile settings search input placeholder */
  mobileSearchPlaceholder: string;
}
