/*
 * Tag hub feature sub-barrel (#1171) — the Connect section's body.
 *
 * The tag-first entrance to the records that replaced the retired
 * force-directed graph (#1152), and — since #1643 retired the tag edit modal
 * into it (D-20260912-main-1) — the one place tags are edited.
 * Pure and injection-only — the host (web/src/connect/ConnectScreen.tsx) does
 * the fetching, resolves copy into TagHubLabels, and owns the selection state
 * and the unsaved drafts.
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
// #1472 — what the shared detail panel shows while a tag is open.
export {
  TagHubDetailPanel,
  type TagHubDetailLabels,
  type TagHubDetailPanelProps,
} from "./TagHubDetailPanel";
// #1643 — the tag editor, folded in from the retired modal.
export {
  TagHubEditBlock,
  type TagHubEditBlockProps,
  type TagHubEditField,
} from "./TagHubEditBlock";
// #1676 — the rail's tag menu and the edit block's drafts, callable from
// outside the hub (the Materials note sidebar, #1677).
export {
  TagActionsMenu,
  useTagActionsMenu,
  type TagActionsMenuLabels,
  type TagActionsMenuProps,
  type TagActionsMenuState,
} from "./TagActionsMenu";
export {
  useTagEditDrafts,
  type TagEditDrafts,
  type TagEditDraftTarget,
  type TagEditWriters,
} from "./useTagEditDrafts";
// #1644 — bulk selection and merging.
export {
  TagHubSelectionBar,
  type TagHubSelectionBarLabels,
  type TagHubSelectionBarProps,
} from "./TagHubSelectionBar";
export {
  TagHubTagPickerPopover,
  type TagHubTagPickerLabels,
  type TagHubTagPickerPopoverProps,
} from "./TagHubTagPickerPopover";
export {
  TagMergeDialog,
  type TagMergeDialogLabels,
  type TagMergeDialogProps,
} from "./TagMergeDialog";
// #1645 — the relations mode and the rule behind it.
export {
  buildItemRelations,
  type BuildItemRelationsInput,
  type ItemRelations,
  type LinkedRelation,
  type RelationTarget,
} from "./buildItemRelations";
export {
  RelationPanel,
  type RelationLink,
  type RelationPanelLabels,
  type RelationPanelProps,
} from "./RelationPanel";
export {
  TagIconPicker,
  type TagIconPickerLabels,
  type TagIconPickerProps,
} from "./TagIconPicker";
export {
  NO_EDITS,
  tagRowPatch,
  type TagRowEdits,
  type TagRowPatch,
  type TagRowPatchTarget,
} from "./tagRowPatch";
export {
  selectRecentTaggedItems,
  TAG_HUB_RECENT_LIMIT,
  type SelectRecentTaggedItemsInput,
} from "./recentTaggedItems";
export {
  UNTAGGED_TAG_ID,
  type TagHubEditLabels,
  type TagHubGroup,
  type TagHubItem,
  type TagHubLabels,
  type TagHubModel,
  type TagHubTagSummary,
} from "./types";
