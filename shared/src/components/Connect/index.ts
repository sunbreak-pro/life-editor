/*
 * Connect feature sub-barrel (W4). Public, presentational node-graph +
 * backlink root for hosts. The graph is built from the UNIFIED item-link
 * model (listNotesUnified / listAllTagConnections / listAllTagAssignments /
 * listAllWikiTagsUnified / listDailiesUnified) — the legacy note_links /
 * note_connections services are Supabase stubs and are NOT used.
 *
 * The host (web ConnectScreen) fetches those reads, resolves copy into the
 * `ConnectGraphLabels` object (§6.4 — no useTranslation in shared), and
 * injects everything into <ConnectGraphView>. The global components/index.ts
 * re-exports this with `export *`.
 */
export { ConnectGraphView } from "./ConnectGraphView";
export type { ConnectGraphViewProps } from "./ConnectGraphView";
export type { ConnectGraphLabels } from "./labels";
export { buildGraphModel, backlinkSourceIds } from "./graph/buildGraphModel";
export type { GraphModelInput } from "./graph/buildGraphModel";
export type { BacklinkEntry, BacklinkViewLabels } from "./BacklinkView";
