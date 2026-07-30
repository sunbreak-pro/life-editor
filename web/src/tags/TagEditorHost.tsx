import { useCallback, useMemo } from "react";
import {
  TagEditModal,
  itemRoleSortKey,
  useTaggedItemIndex,
  useWikiTagsUnifiedAPI,
  useTranslation,
  type DataService,
  type TagEditItem,
  type TagEditRow,
} from "@life-editor/shared";

/*
 * TagEditorHost (#409) — the app-global tag master panel.
 *
 * Before #409 the TagEditModal was wired only from the Notes sidebar, so the
 * one screen that shows tags as a list (Todo's tag view) could not edit them
 * and the one screen that could edit them had no tag list. The entry point is
 * now the app shell's left sidebar (above ⌘K), which means the panel outlives
 * any single section — so it cannot rely on a section-layer Provider.
 *
 * Two consequences shape this host:
 *
 * 1. It calls `useWikiTagsUnifiedAPI` DIRECTLY rather than reading
 *    WikiTagsUnifiedContext. That Provider is section-layer (rules/frontend.md
 *    — Materials / Schedule / Connect each mount their own), and this panel is
 *    reachable from Briefing / Work / Analytics / Settings / Trash too, where no
 *    such Provider exists. The hook takes its DataService as a parameter (§6.4),
 *    so the shell can own an instance of its own. Writes land in Supabase and
 *    the Realtime echo bumps `syncVersion`, which is what makes a section's own
 *    Provider re-read the change — the same path an MCP-side edit takes.
 *
 * 2. It is MOUNT-ON-OPEN (the parent renders it only while open). The tag hook
 *    fetches tags + assignments + connections on mount and again on every
 *    `syncVersion` bump; keeping that alive app-wide for a panel that is closed
 *    99% of the time would add three queries to every sync round for nothing.
 */

export interface TagEditorHostProps {
  open: boolean;
  onClose: () => void;
  dataService: DataService;
}

export function TagEditorHost({
  open,
  onClose,
  dataService,
}: TagEditorHostProps) {
  // Mount-on-open: no tag/assignment fetching at all until the user asks.
  if (!open) return null;
  return <TagEditorPanel onClose={onClose} dataService={dataService} />;
}

function TagEditorPanel({
  onClose,
  dataService,
}: {
  onClose: () => void;
  dataService: DataService;
}) {
  const { t } = useTranslation();
  const {
    allTags,
    allAssignments,
    countsByTag,
    createTag,
    renameTag,
    deleteTag,
    setTagColor,
    setTagIcon,
    unassignTagFromItem,
  } = useWikiTagsUnifiedAPI({ dataService });
  const { index: itemIndex } = useTaggedItemIndex(dataService);

  const untitled = t("materials.tags.untitledItem");
  const roleLabels = useMemo(
    () => ({
      task: t("itemRole.task"),
      event: t("itemRole.event"),
      note: t("itemRole.note"),
      daily: t("itemRole.daily"),
      unknown: t("itemRole.unknown"),
    }),
    [t],
  );

  /*
   * Bucket the live assignments by tag. Iterating the ASSIGNMENTS (not the
   * resolved item index) is deliberate: assignments carry neither role nor
   * title (types/wikiTagUnified), and an id the index cannot name — a routine,
   * a dismissed event, see useTaggedItemIndex — must still get a row so the
   * user can remove it. Those render the neutral "unknown kind" badge. It also
   * keeps `items.length` equal to the `count` pill, which is derived from the
   * same live-only assignment cache.
   */
  const itemsByTag = useMemo(() => {
    const map = new Map<string, TagEditItem[]>();
    for (const tag of allTags) map.set(tag.id, []);
    for (const assignment of allAssignments) {
      if (assignment.isDeleted) continue;
      const bucket = map.get(assignment.tagId);
      if (!bucket) continue;
      const info = itemIndex.get(assignment.itemId);
      bucket.push({
        assignmentId: assignment.id,
        itemId: assignment.itemId,
        // "" is outside the designed role set, so resolveItemRole → null and
        // the badge falls back to the unknown kind.
        role: info?.role ?? "",
        title: info?.title || untitled,
      });
    }
    // Group by kind (ITEM_ROLE_ORDER), then alphabetically inside a kind, so
    // the badges read as runs instead of alternating down the list.
    for (const bucket of map.values()) {
      bucket.sort(
        (a, b) =>
          itemRoleSortKey(a.role) - itemRoleSortKey(b.role) ||
          a.title.localeCompare(b.title),
      );
    }
    return map;
  }, [allTags, allAssignments, itemIndex, untitled]);

  const tagRows = useMemo<TagEditRow[]>(
    () =>
      allTags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        icon: tag.icon,
        count: countsByTag.get(tag.id) ?? 0,
        items: itemsByTag.get(tag.id) ?? [],
      })),
    [allTags, countsByTag, itemsByTag],
  );

  const handleUnassign = useCallback(
    (assignmentId: string) => void unassignTagFromItem(assignmentId),
    [unassignTagFromItem],
  );

  return (
    <TagEditModal
      open
      onClose={onClose}
      tags={tagRows}
      onCreate={(name) => void createTag(name)}
      onRename={(id, name) => void renameTag(id, name)}
      onDelete={(id) => void deleteTag(id)}
      onSetColor={(id, color) => void setTagColor(id, color)}
      onSetIcon={(id, icon) => void setTagIcon(id, icon)}
      onUnassign={handleUnassign}
      formatCount={(count) => t("materials.tags.usageCount", { count })}
      labels={{
        title: t("materials.tags.editTitle"),
        addPlaceholder: t("materials.tags.addPlaceholder"),
        addButton: t("materials.tags.addTag"),
        empty: t("materials.tags.empty"),
        filterPlaceholder: t("materials.tags.filterPlaceholder"),
        filterLabel: t("materials.tags.filterLabel"),
        filterEmpty: t("materials.tags.filterEmpty"),
        renameLabel: t("materials.tags.rename"),
        deleteLabel: t("materials.tags.deleteTag"),
        iconLabel: t("materials.tags.iconLabel"),
        clearIconLabel: t("materials.tags.clearIcon"),
        colorLabel: t("materials.tags.colorLabel"),
        colorClearLabel: t("materials.tags.colorClearLabel"),
        colorCustomLabel: t("materials.tags.colorCustomLabel"),
        itemsToggleLabel: t("materials.tags.itemsToggle"),
        itemsEmpty: t("materials.tags.itemsEmpty"),
        unassignLabel: t("materials.tags.unassign"),
        roles: roleLabels,
      }}
    />
  );
}
