import { useCallback, useMemo, useRef } from "react";
import {
  ConfirmDialog,
  useConfirmDialog,
  TagEditModal,
  itemRoleSortKey,
  useTaggedItemIndex,
  useWikiTagsUnifiedAPI,
  useTranslation,
  type DataService,
  type TagEditItem,
  type TagEditRow,
} from "@life-editor/shared";
// Section-agnostic despite living under schedule/ (#628 → #707): the two facts
// it pins — never ask when nothing is pending, never clear the flag on a
// REFUSED close — are the same for any editor whose only commit is a button.
import { decideUnsavedClose } from "../schedule/unsavedCloseGuard";

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

  /*
   * Unsaved-close guard (#715, same shape as #628's EventEditorPane). Since the
   * panel only commits on its per-row save button, every close affordance —
   * Esc, the backdrop, whatever opened it — can now throw a typed rename away.
   * The panel reports whether anything is pending; asking about it belongs
   * here, because this is what owns `onClose`. A ref (not state) keeps the
   * report from re-rendering the panel on every keystroke.
   *
   * The question is the in-app <ConfirmDialog> (#707), not the browser's own
   * native one: that lands outside the theme and freezes the page hard enough
   * to stall Playwright. Its answer arrives a tick later, which is why the
   * whole decision goes through the shared `decideUnsavedClose` — a guard that
   * read the pending promise as a truthy "yes" would discard the draft the
   * moment the dialog opened.
   */
  const {
    request: confirmRequest,
    ask: askConfirm,
    resolve: resolveConfirm,
  } = useConfirmDialog();
  const dirtyRef = useRef(false);
  const close = useCallback(() => {
    void (async () => {
      const decision = await decideUnsavedClose({
        dirty: dirtyRef.current,
        askDiscard: () =>
          askConfirm({
            message: t("materials.tags.unsavedCloseConfirm"),
            confirmLabel: t("common.discard"),
            cancelLabel: t("common.cancel"),
            // Throwing away typed-in work is the destructive answer here, even
            // though nothing is deleted from the database.
            danger: true,
          }),
      });
      if (decision.clearDirty) dirtyRef.current = false;
      if (decision.close) onClose();
    })();
  }, [askConfirm, onClose, t]);

  return (
    <>
      <TagEditModal
        open
        onClose={close}
        onDirtyChange={(dirty) => {
          dirtyRef.current = dirty;
        }}
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
          closeLabel: t("common.close"),
          addPlaceholder: t("materials.tags.addPlaceholder"),
          addButton: t("materials.tags.addTag"),
          empty: t("materials.tags.empty"),
          filterPlaceholder: t("materials.tags.filterPlaceholder"),
          filterLabel: t("materials.tags.filterLabel"),
          filterEmpty: t("materials.tags.filterEmpty"),
          listLabel: t("materials.tags.listLabel"),
          renameLabel: t("materials.tags.rename"),
          saveLabel: t("materials.tags.save"),
          savedLabel: t("materials.tags.saved"),
          unsavedLabel: t("materials.tags.unsaved"),
          deleteLabel: t("materials.tags.deleteTag"),
          iconLabel: t("materials.tags.iconLabel"),
          clearIconLabel: t("materials.tags.clearIcon"),
          colorLabel: t("materials.tags.colorLabel"),
          colorClearLabel: t("materials.tags.colorClearLabel"),
          colorCustomLabel: t("materials.tags.colorCustomLabel"),
          detailEmpty: t("materials.tags.detailEmpty"),
          backLabel: t("materials.tags.backToList"),
          itemsHeading: t("materials.tags.itemsHeading"),
          itemsEmpty: t("materials.tags.itemsEmpty"),
          unassignLabel: t("materials.tags.unassign"),
          // The panel asks this one itself (#740): switching tags is its own
          // interaction, and only it knows a draft is about to be unmounted.
          // The close guard below stays here, where `onClose` lives.
          switchConfirm: t("materials.tags.unsavedSwitchConfirm"),
          discardLabel: t("common.discard"),
          cancelLabel: t("common.cancel"),
          roles: roleLabels,
        }}
      />

      {/* Mounted last so it portals ABOVE the tag panel it is asked from — the
          discard question has to sit on top of the thing it is about (#707).
          It holds no place in the tree while nothing is being asked. */}
      {confirmRequest && (
        <ConfirmDialog
          open
          message={confirmRequest.message}
          confirmLabel={confirmRequest.confirmLabel}
          cancelLabel={confirmRequest.cancelLabel}
          danger={confirmRequest.danger}
          onConfirm={() => resolveConfirm(true)}
          onCancel={() => resolveConfirm(false)}
        />
      )}
    </>
  );
}
