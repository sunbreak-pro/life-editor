/*
 * Tag hub feature sub-barrel (#1171) — the Connect section's body.
 *
 * The tag-first entrance to the records that replaced the retired
 * force-directed graph (#1152): pick a topic, read what is filed under it.
 * Pure and injection-only — the host (web/src/connect/ConnectScreen.tsx) does
 * the fetching, resolves copy into TagHubLabels, and owns the selection state.
 *
 * The global components/index.ts re-exports this with `export *`.
 */
export {
  buildTagHubModel,
  type BuildTagHubModelInput,
} from "./buildTagHubModel";
export { TagHubView, type TagHubViewProps } from "./TagHubView";
export { TagHubTagRail, type TagHubTagRailProps } from "./TagHubTagRail";
export {
  TagHubItemGroups,
  type TagHubItemGroupsProps,
} from "./TagHubItemGroups";
export {
  UNTAGGED_TAG_ID,
  type TagHubGroup,
  type TagHubItem,
  type TagHubLabels,
  type TagHubModel,
  type TagHubTagSummary,
} from "./types";
