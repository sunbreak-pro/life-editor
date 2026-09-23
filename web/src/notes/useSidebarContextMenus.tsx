import { useCallback, useMemo, useState, type MouseEvent } from "react";
import {
  ConfirmDialog,
  ItemActionPopover,
  TagActionsMenu,
  TagHubEditBlock,
  useConfirmDialog,
  useTagActionsMenu,
  useTagEditDrafts,
  useTranslation,
  useWikiTagsUnifiedContext,
  type NoteNode,
  type TagHubTagSummary,
} from "@life-editor/shared";
import { TagPicker } from "../wikitag";

/*
 * Right-click editing for the Notes right sidebar (#1677), Desktop only.
 *
 * Two surfaces, two panels:
 *
 *   - A TAG row (a filter chip or a group heading) opens the SAME four-item
 *     menu Connect's rail opens from its "…" — the shared TagActionsMenu, not
 *     a second Notes-local menu. Rename / icon / colour then open the shared
 *     TagHubEditBlock over the sidebar, with the field the user picked already
 *     focused, and delete asks first.
 *   - A NOTE row opens the generic ItemActionPopover (#307): its title, its
 *     tags (the same TagPicker the detail pane carries) and rename / delete.
 *     The body is not editable here — that is what opening the note is for.
 *
 * WHY A HOOK AND NOT A COMPONENT. The handlers have to reach the rows, which
 * are drawn deep inside NotesSidebarList, while the panels have to be drawn
 * once at the host. Returning both from one hook keeps the pairing in a single
 * file instead of threading four props through the list for the panels' sake.
 *
 * DESKTOP ONLY, decided by the caller passing `enabled` (NotesView already
 * knows the width). When it is false the two handlers are `undefined`, so the
 * rows attach no `contextmenu` listener at all and the browser's own menu is
 * left alone — a touch surface has no right-click and a long-press there is
 * the platform's text selection.
 *
 * The drafts are the shared one-commit contract (useTagEditDrafts, #715):
 * typing a name writes nothing until the block's save button is pressed.
 */

/** What the hook needs from the Notes host. */
export interface SidebarContextMenusOptions {
  /** Desktop-only gate. False → no handlers, no listeners (#1677). */
  enabled: boolean;
  /** Every note the sidebar can list, for the note panel's title + id. */
  notes: readonly NoteNode[];
  /** Rename a note (the host's own writer — it owns the notes context). */
  onRenameNote: (id: string, title: string) => void;
  /** The host's delete flow, confirmation and all. */
  onDeleteNote: (id: string) => void;
}

export interface SidebarContextMenus {
  /** `contextmenu` on a tag row. Undefined on narrow. */
  onTagContextMenu?: (tagId: string, event: MouseEvent) => void;
  /** `contextmenu` on a note row. Undefined on narrow. */
  onNoteContextMenu?: (noteId: string, event: MouseEvent) => void;
  /** The panels themselves — rendered once, anywhere in the host's tree. */
  menus: React.JSX.Element | null;
}

/** The tag edit panel's width (#1886 — was 320). */
const TAG_EDIT_PANEL_WIDTH = 420;

export function useSidebarContextMenus({
  enabled,
  notes,
  onRenameNote,
  onDeleteNote,
}: SidebarContextMenusOptions): SidebarContextMenus {
  const { t } = useTranslation();
  const wiki = useWikiTagsUnifiedContext();
  const { allTags } = wiki;

  // ---- Tag menu + editor ------------------------------------------------

  const tagMenu = useTagActionsMenu();
  const [menuTagId, setMenuTagId] = useState<string | null>(null);
  const [editTagId, setEditTagId] = useState<string | null>(null);
  const [editFocusName, setEditFocusName] = useState(false);
  const drafts = useTagEditDrafts(allTags, wiki);

  const onTagContextMenu = useCallback(
    (tagId: string, event: MouseEvent) => {
      setMenuTagId(tagId);
      tagMenu.openAtPointer(event);
    },
    [tagMenu],
  );

  const menuTag = useMemo(
    () => allTags.find((tag) => tag.id === menuTagId) ?? null,
    [allTags, menuTagId],
  );

  // The block edits ONE tag, drawn from the live row so a rename arriving from
  // sync or MCP shows up under an untouched field (#628).
  const editTag = useMemo<TagHubTagSummary | null>(() => {
    const row = allTags.find((tag) => tag.id === editTagId);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      color: row.color ?? null,
      icon: row.icon ?? null,
      // The count belongs to the hub's own grouped rows; this sidebar lists
      // notes only, so counting here would state something narrower than the
      // number Connect shows for the same tag. The block prints the name, the
      // icon and the colour — the three things this panel edits.
      count: 0,
      isUntagged: false,
    };
  }, [allTags, editTagId]);

  const {
    request: confirmRequest,
    ask: askConfirm,
    resolve: resolveConfirm,
  } = useConfirmDialog();

  const requestTagDelete = useCallback(
    (tagId: string) => {
      const tag = allTags.find((row) => row.id === tagId);
      void (async () => {
        const ok = await askConfirm({
          message: t("connect.deleteConfirm", { name: tag?.name ?? "" }),
          confirmLabel: t("connect.deleteTag"),
          cancelLabel: t("common.cancel"),
          danger: true,
        });
        if (!ok) return;
        void wiki.deleteTag(tagId);
        // The editor is over a tag that is about to stop existing.
        drafts.discard(tagId);
        setEditTagId((open) => (open === tagId ? null : open));
      })();
    },
    [allTags, askConfirm, t, wiki, drafts],
  );

  // ---- Note panel -------------------------------------------------------

  const [noteMenu, setNoteMenu] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);

  const onNoteContextMenu = useCallback((noteId: string, event: MouseEvent) => {
    event.preventDefault();
    setNoteMenu({ id: noteId, x: event.clientX, y: event.clientY });
  }, []);

  const menuNote = useMemo(
    () => notes.find((note) => note.id === noteMenu?.id) ?? null,
    [notes, noteMenu],
  );

  const tagLabels = useMemo(
    () => ({
      rowMenu: t("connect.rowMenu"),
      editTagMenu: t("connect.editTagMenu"),
      deleteTag: t("connect.deleteTag"),
    }),
    [t],
  );

  const editLabels = useMemo(
    () => ({
      nameLabel: t("connect.edit.nameLabel"),
      iconLabel: t("connect.edit.iconLabel"),
      colorLabel: t("connect.edit.colorLabel"),
      iconChange: t("connect.edit.iconChange"),
      iconClear: t("connect.edit.iconClear"),
      iconSearch: t("connect.edit.iconSearch"),
      iconNoMatch: t("connect.edit.iconNoMatch"),
      colorDefault: t("connect.edit.colorDefault"),
      colorCustom: t("connect.edit.colorCustom"),
      deleteTag: t("connect.deleteTag"),
      saved: t("connect.edit.saved"),
      unsaved: t("connect.edit.unsaved"),
      save: t("connect.edit.save"),
    }),
    [t],
  );

  const noteTitle = menuNote
    ? menuNote.title || t("materials.notes.untitled")
    : "";

  const menus = (
    <>
      {menuTag && (
        <TagActionsMenu
          open={tagMenu.open}
          onClose={tagMenu.close}
          tagName={menuTag.name}
          anchorPoint={tagMenu.anchorPoint}
          labels={tagLabels}
          onEdit={() => {
            setEditTagId(menuTag.id);
            setEditFocusName(true);
          }}
          onDelete={() => requestTagDelete(menuTag.id)}
        />
      )}

      {/* The block is a panel here, not a pane: the sidebar has no column to
          put it in, so it rides the generic popover's portal + dismiss (Esc,
          outside-mousedown) and sits where the pointer was. */}
      {editTag && (
        <ItemActionPopover
          position={{
            x: tagMenu.anchorPoint?.x ?? 0,
            y: tagMenu.anchorPoint?.y ?? 0,
          }}
          label={`${editTag.name}: ${t("connect.editTag")}`}
          // #1886 — 320 squeezed the name field, the icon row and the twelve
          // swatches together. The panel may spill over the main column; the
          // popover's viewport clamp keeps it on screen at the new width.
          width={TAG_EDIT_PANEL_WIDTH}
          summary={
            <TagHubEditBlock
              tag={editTag}
              edits={drafts.editsFor(editTag.id)}
              dirty={drafts.isDirty(editTag.id)}
              focusName={editFocusName}
              onEdit={(patch) => {
                drafts.edit(editTag.id, patch);
                // Consumed once: a re-render must not steal the caret back to
                // the name field.
                setEditFocusName(false);
              }}
              onDropEdit={(field) => drafts.drop(editTag.id, field)}
              onSave={() => {
                drafts.save(editTag.id);
                setEditTagId(null);
              }}
              onDelete={() => requestTagDelete(editTag.id)}
              labels={editLabels}
            />
          }
          onClose={() => setEditTagId(null)}
        />
      )}

      {menuNote && noteMenu && (
        <ItemActionPopover
          position={{ x: noteMenu.x, y: noteMenu.y }}
          label={`${noteTitle}: ${t("materials.notes.rowActions")}`}
          summary={
            <div className="flex flex-col gap-2">
              <p className="truncate text-sm font-semibold text-lumen-text">
                {noteTitle}
              </p>
              {/* The same picker the detail pane carries (#1404-era wiring):
                  it reads and writes assignments through the tags context on
                  its own, so adding and removing here needs no second path. */}
              <TagPicker itemId={menuNote.id} size="sm" />
            </div>
          }
          actions={[
            {
              id: "rename",
              label: t("materials.notes.renameNote"),
              // The popover's inline input is IME-safe (#551) — Enter while a
              // conversion is open does not commit.
              inlineInput: {
                value: menuNote.title,
                ariaLabel: t("materials.notes.renameNote"),
                onCommit: (title) => {
                  onRenameNote(menuNote.id, title);
                  setNoteMenu(null);
                },
              },
            },
            {
              id: "delete",
              label: t("materials.notes.deleteNote"),
              danger: true,
              onSelect: () => {
                onDeleteNote(menuNote.id);
                setNoteMenu(null);
              },
            },
          ]}
          onClose={() => setNoteMenu(null)}
        />
      )}

      {/* The in-app question (#707), never the browser's own. Mounted last so
          it portals above the panel the delete was chosen in. */}
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

  return {
    onTagContextMenu: enabled ? onTagContextMenu : undefined,
    onNoteContextMenu: enabled ? onNoteContextMenu : undefined,
    menus: enabled ? menus : null,
  };
}
