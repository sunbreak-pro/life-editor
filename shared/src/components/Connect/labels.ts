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
  /**
   * connect.graph.linkCreateFailed — inline error shown when the wired
   * onCreateLink rejects (e.g. a pasted id that fails the DB write). Resolved
   * by the web host (ConnectScreen) from the en/ja catalog leaves. Kept
   * OPTIONAL so other hosts (Electron / Capacitor) that have not wired it yet
   * stay compile-compatible; the card falls back to an English default when a
   * host leaves it unset.
   */
  linkCreateFailed?: string;
  /** connect.graph.linkDeleteFailed — inline error when onDeleteLink rejects (see linkCreateFailed). */
  linkDeleteFailed?: string;

  // ---- backlinks (backlinks.*) ----
  backlinksTitle: string;
  backlinksEmpty: string;
}
