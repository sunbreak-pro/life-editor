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

  // ---- backlinks (backlinks.*) ----
  backlinksTitle: string;
  backlinksEmpty: string;
}
