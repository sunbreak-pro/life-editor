import { useMemo } from "react";
import {
  useTagGroupContext,
  useTranslation,
  useWikiTagsUnifiedContext,
  type TagFilterPanelGroup,
  type TagFilterPanelLabels,
  type TagFilterPanelProps,
  type TagFilterPanelTag,
} from "@life-editor/shared";

/*
 * Everything <TagFilterPanel> needs, assembled from the two Contexts and the
 * grid's filter state (#1173). Lives here rather than in CalendarTab because
 * it is the whole seam between the panel and the app: the panel is pure
 * presentation, so if this hook is right the panel cannot be wrong.
 *
 * Group WRITES go straight to the tag-group Context, but applying one goes
 * back OUT through `onApplyGroup` to the grid's filter state — the tick list
 * is the single source of truth for what is drawn (rule 5 in
 * useScheduleGridFilters), and a second writer here would be the desync that
 * rule exists to prevent.
 */

export interface UseTagFilterPanelArgs {
  /** The tick list, dead tags already dropped. */
  selectedTagIds: string[];
  /** Rows each tag would leave on the grid if ticked alone. */
  tagCounts: Map<string, number>;
  onToggleTag: (tagId: string) => void;
  onClear: () => void;
  /** Copies a saved group's tags into the tick list. */
  onApplyGroup: (groupId: string) => void;
}

export function useTagFilterPanel({
  selectedTagIds,
  tagCounts,
  onToggleTag,
  onClear,
  onApplyGroup,
}: UseTagFilterPanelArgs): TagFilterPanelProps {
  const { t } = useTranslation();
  // `loading` here means "no data yet" (it stays false across background
  // refetches — the #300 note in useWikiTagsUnifiedAPI), which is the only
  // window in which an empty list must not be read as "you have no tags".
  const { allTags, loading: tagsLoading } = useWikiTagsUnifiedContext();
  const { tagGroups, createTagGroup, updateTagGroup, deleteTagGroup } =
    useTagGroupContext();

  // `allTags` is already active-only (the service filters is_deleted=false).
  const tags = useMemo<TagFilterPanelTag[]>(
    () =>
      allTags
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((tag) => ({
          id: tag.id,
          name: tag.name,
          color: tag.color,
          count: tagCounts.get(tag.id) ?? 0,
        })),
    [allTags, tagCounts],
  );

  const tagNameById = useMemo(
    () => new Map(allTags.map((tag) => [tag.id, tag.name])),
    [allTags],
  );

  const selectedKey = useMemo(
    () => [...selectedTagIds].sort().join(" "),
    [selectedTagIds],
  );

  const groups = useMemo<TagFilterPanelGroup[]>(
    () =>
      tagGroups.map((group) => {
        // Soft-deleted tags survive the ON DELETE CASCADE, so a group can hold
        // ids no active list returns. They are dropped from the NAMES (there is
        // nothing to show) and from the identity test below, which is what
        // keeps a group's chip lit after one of its tags is deleted.
        const live = group.tagIds.filter((id) => tagNameById.has(id));
        return {
          id: group.id,
          name: group.name,
          tagNames: live.map((id) => tagNameById.get(id) ?? id),
          active: live.length > 0 && [...live].sort().join(" ") === selectedKey,
          deleteLabel: t("scheduleScreen.filterGroupDelete", {
            name: group.name,
          }),
        };
      }),
    [tagGroups, tagNameById, selectedKey, t],
  );

  const labels = useMemo<TagFilterPanelLabels>(
    () => ({
      tagsHeading: t("scheduleScreen.filterTagsHeading"),
      tagsLabel: t("scheduleScreen.filterTagsLabel"),
      noTags: t("scheduleScreen.filterNoTags"),
      tagsLoading: t("scheduleScreen.filterTagsLoading"),
      clear: t("scheduleScreen.filterClear"),
      selectedCount: t("scheduleScreen.filterSelectedCount", {
        count: selectedTagIds.length,
      }),
      groupsHeading: t("scheduleScreen.filterGroupsHeading"),
      groupsEmpty: t("scheduleScreen.filterGroupsEmpty"),
      namePlaceholder: t("scheduleScreen.filterGroupNamePlaceholder"),
      save: t("scheduleScreen.filterGroupSave"),
      saveHint: t("scheduleScreen.filterGroupSaveHint"),
      apply: t("scheduleScreen.filterGroupApply"),
      renameGroup: t("scheduleScreen.filterGroupRename"),
      groupEmpty: t("scheduleScreen.filterGroupEmpty"),
    }),
    [t, selectedTagIds.length],
  );

  return {
    tags,
    selectedTagIds,
    onToggleTag,
    onClear,
    groups,
    // The panel hands up the trimmed name; the tick list is already the
    // resolved (live-tag) one, so a group can never be saved holding an id
    // that no longer exists.
    onSaveGroup: (name) => createTagGroup(name, selectedTagIds),
    onApplyGroup,
    onRenameGroup: (groupId, name) => updateTagGroup(groupId, { name }),
    onDeleteGroup: deleteTagGroup,
    tagsLoading,
    labels,
  };
}
