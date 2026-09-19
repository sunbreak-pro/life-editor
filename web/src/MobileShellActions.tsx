import { Undo2, Redo2, Search, Tags as TagsIcon } from "lucide-react";
import {
  BottomTabActionRow,
  useTranslation,
  useUndoRedoContext,
} from "@life-editor/shared";

export interface MobileShellActionsProps {
  /** Open the command palette (#473). */
  onOpenPalette: () => void;
  /** Walk to the Connect section, where tags are edited (#1290 / #1643). */
  onOpenTagEditor: () => void;
  /** Dismiss the "More" sheet, so a surface opened from a row is not behind it. */
  closeSheet: () => void;
}

/*
 * MobileShellActions (#472) — the app-global rows the narrow bottom bar's
 * "More" sheet carries.
 *
 * Why here: the wide layout puts undo/redo and the command-palette field in the
 * header slot (see HeaderUndoRedo / CommandSearchField), and AppShell renders
 * `header` on its WIDE branch only, so the narrow layout had no path to either.
 * The keyboard route is no help — GlobalShortcuts' ⌘Z / ⌘K needs the
 * ShortcutConfig Provider, which native mobile deliberately skips (CLAUDE.md
 * §2). The "More" sheet is the only chrome every narrow section shares, which
 * is why these land there.
 *
 * The history stays ONE global stack (#304's design): this reads the very same
 * UndoRedoContext the header buttons read — no per-surface fork. Same for the
 * palette: this flips MainScreen's one `paletteOpen` state, so mobile and
 * Desktop drive a single mounted <CommandPalette>.
 *
 * The tag row (#1290) is the palette row's twin. On the wide layout the tag
 * master's entry is the sidebar footer row above ⌘K (SidebarNav), and the
 * narrow layout renders no sidebar — so until #1290 a phone could not reach it
 * at all. Since #1643 both entries walk to the Connect SECTION rather than
 * opening a panel over whatever is on screen: the tag edit modal was retired
 * into that section (D-20260912-main-1 Q1-A), so there is nothing left to open.
 *
 * This is a component rather than a hook called in MainScreen's body for the
 * same reason HeaderUndoRedo is: MainScreen MOUNTS <UndoRedoHost> (its own body
 * therefore sits outside the Provider), so the context can only be read from a
 * component rendered inside the shell.
 *
 * Order: the rows that OPEN a surface (palette, tags) read first, then the rows
 * that act on what you just did (undo, redo).
 *
 * Undo/redo deliberately do NOT call `closeSheet` — undo repeats, and closing
 * on the first tap would turn a three-step undo into three reopens. The palette
 * and tag rows are the opposite case: each takes the user somewhere, so the
 * sheet has to be cleared out of the way first.
 *
 * These rows stay on the APP stack, unlike the header pair (#1690). The header
 * follows focus because it can: its buttons keep the editor focused while you
 * press them. Opening this sheet takes focus by definition — the body editor
 * is behind it — so "the focused editor's history" has no meaning here, and
 * pretending otherwise would mean guessing at which editor the user last
 * touched. The phone reaches the body's own undo through the same header pair
 * the narrow layout already carries (#1035).
 */
export function MobileShellActions({
  onOpenPalette,
  onOpenTagEditor,
  closeSheet,
}: MobileShellActionsProps) {
  const { t } = useTranslation();
  const { undo, redo, canUndo, canRedo } = useUndoRedoContext();

  return (
    <>
      <BottomTabActionRow
        label={t("nav.commandPalette")}
        icon={<Search size={18} />}
        onSelect={() => {
          closeSheet();
          onOpenPalette();
        }}
      />
      <BottomTabActionRow
        label={t("nav.tagEditor")}
        icon={<TagsIcon size={18} />}
        onSelect={() => {
          closeSheet();
          onOpenTagEditor();
        }}
      />
      <BottomTabActionRow
        label={t("common.undo")}
        icon={<Undo2 size={18} />}
        onSelect={() => undo()}
        disabled={!canUndo()}
      />
      <BottomTabActionRow
        label={t("common.redo")}
        icon={<Redo2 size={18} />}
        onSelect={() => redo()}
        disabled={!canRedo()}
      />
    </>
  );
}
