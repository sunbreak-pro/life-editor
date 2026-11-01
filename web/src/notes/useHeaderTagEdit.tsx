import { useCallback, useMemo, useState, type MouseEvent } from "react";
import {
  ConfirmDialog,
  TagQuickEditPopover,
  useConfirmDialog,
  useTranslation,
  useWikiTagsUnifiedContext,
} from "@life-editor/shared";

/*
 * The edit panel under a tag chip in the note header (#2395). It replaces, for
 * these chips only, the four-item menu and the second step it led to (#2007).
 * The sidebar's tag rows keep that menu (useSidebarContextMenus).
 *
 * Delete asks first, in the same words as that menu. The panel stays up under the
 * question, so a "no" returns to it with the unsaved drafts intact, and a "yes"
 * closes it and then deletes. The question is drawn inside `panel`, so the host
 * mounts nothing new.
 *
 * Right-click on Desktop, a hold on narrow, decided by `enabled` the way the
 * sidebar's hook decides it. The panel is drawn once at the host, from a hook
 * for the same reason as there: the handlers have to reach the chips, deep inside
 * the detail surface, and the panel does not.
 */

export interface HeaderTagEditOptions {
  /** Is this the Desktop width? True → right-click, false → long-press. */
  enabled: boolean;
  /** Open a tag on Connect's tag screen. Absent → no such button. */
  onOpenTag?: (tagId: string) => void;
}

export interface HeaderTagEdit {
  /** `contextmenu` on a chip. Undefined on narrow. */
  onTagContextMenu?: (tagId: string, event: MouseEvent) => void;
  /** A hold on a chip. Undefined on Desktop. */
  onTagLongPress?: (tagId: string, chip: HTMLElement) => void;
  /** The panel itself, rendered once anywhere in the host's tree. */
  panel: React.JSX.Element | null;
}

/** The space between the tag row and the panel, in px. */
const ROW_GAP = 4;

/**
 * Lined up with the chip, under the whole row: a chip on the first line of a
 * wrapped row must not open the panel over the second line.
 */
function pointUnderTagRow(chip: HTMLElement): { x: number; y: number } {
  const row = chip.closest("[data-tag-row]") ?? chip;
  return {
    x: chip.getBoundingClientRect().left,
    y: row.getBoundingClientRect().bottom + ROW_GAP,
  };
}

export function useHeaderTagEdit({
  enabled,
  onOpenTag,
}: HeaderTagEditOptions): HeaderTagEdit {
  const { t } = useTranslation();
  const wiki = useWikiTagsUnifiedContext();
  const [open, setOpen] = useState<{
    tagId: string;
    chip: HTMLElement;
    position: { x: number; y: number };
  } | null>(null);

  const openUnder = useCallback((tagId: string, chip: HTMLElement) => {
    setOpen({ tagId, chip, position: pointUnderTagRow(chip) });
  }, []);

  const onTagContextMenu = useCallback(
    (tagId: string, event: MouseEvent) => {
      event.preventDefault();
      openUnder(tagId, event.currentTarget as HTMLElement);
    },
    [openUnder],
  );

  const close = useCallback(() => setOpen(null), []);

  const {
    request: confirmRequest,
    ask: askConfirm,
    resolve: resolveConfirm,
  } = useConfirmDialog();

  const { allTags, deleteTag } = wiki;
  const requestDelete = useCallback(
    (tagId: string) => {
      const name = allTags.find((row) => row.id === tagId)?.name ?? "";
      void (async () => {
        const ok = await askConfirm({
          message: t("connect.deleteConfirm", { name }),
          confirmLabel: t("connect.deleteTag"),
          cancelLabel: t("common.cancel"),
          danger: true,
        });
        if (!ok) return;
        close();
        void deleteTag(tagId);
      })();
    },
    [allTags, askConfirm, close, deleteTag, t],
  );

  const labels = useMemo(
    () => ({
      nameLabel: t("connect.edit.nameLabel"),
      iconLabel: t("connect.edit.iconLabel"),
      colorLabel: t("connect.edit.colorLabel"),
      iconMore: t("connect.edit.iconMore"),
      iconCount: t("connect.edit.iconCount"),
      iconClear: t("connect.edit.iconClear"),
      iconSearch: t("connect.edit.iconSearch"),
      iconNoMatch: t("connect.edit.iconNoMatch"),
      colorDefault: t("connect.edit.colorDefault"),
      deleteTag: t("connect.deleteTag"),
      save: t("connect.edit.save"),
      saving: t("connect.edit.saving"),
      cancel: t("common.cancel"),
      openInTags: t("connect.edit.openInTags"),
      duplicateName: t("connect.edit.duplicateName"),
      saveFailed: t("connect.edit.saveFailed"),
    }),
    [t],
  );

  // Looked up live, so a rename arriving from sync shows under an untouched
  // field (#628), and a tag deleted elsewhere takes the panel with it.
  const tag = open
    ? (allTags.find((row) => row.id === open.tagId) ?? null)
    : null;

  return {
    onTagContextMenu: enabled ? onTagContextMenu : undefined,
    onTagLongPress: enabled ? undefined : openUnder,
    panel:
      (open && tag) || confirmRequest ? (
        <>
          {open && tag ? (
            <TagQuickEditPopover
              // A second tag starts from its own stored values, with no drafts
              // left over from the first.
              key={tag.id}
              tag={tag}
              tags={allTags}
              writers={wiki}
              position={open.position}
              anchor={open.chip}
              label={`${tag.name}: ${t("connect.editTag")}`}
              labels={labels}
              onClose={close}
              onOpenInTags={onOpenTag}
              onDelete={requestDelete}
            />
          ) : null}
          {/* Outside the tag check: a tag deleted elsewhere takes the panel
              with it, and dropping the question too would leave its promise
              pending, so every later question would be refused. It stays up to
              be answered, and with no tag left its "yes" has nothing to delete,
              so it answers no. */}
          {confirmRequest && (
            <ConfirmDialog
              open
              message={confirmRequest.message}
              confirmLabel={confirmRequest.confirmLabel}
              cancelLabel={confirmRequest.cancelLabel}
              danger={confirmRequest.danger}
              onConfirm={() => resolveConfirm(tag !== null)}
              onCancel={() => resolveConfirm(false)}
            />
          )}
        </>
      ) : null,
  };
}
