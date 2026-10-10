import { Undo2, Redo2, Search } from "lucide-react";
import { BottomTabActionRow, useTranslation } from "@life-editor/shared";
import { useLatestHistory } from "./useLatestHistory";

export interface MobileShellActionsProps {
  /** Open the command palette (#473). */
  onOpenPalette: () => void;
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
 * Undo / redo call the very same function the header buttons call
 * (`useLatestHistory` → `undoLatest`, #2141) — no per-surface fork. Same for the
 * palette: this flips MainScreen's one `paletteOpen` state, so mobile and
 * Desktop drive a single mounted <CommandPalette>.
 *
 * There is no tag row any more (#1851). #1290 added "Edit tags" here because a
 * phone had no way to reach the tag master; #1643 then retired the master into
 * the Connect section and pointed the row at it — which the same sheet already
 * lists as a section, so the two rows landed on the identical screen. Tags are
 * edited from Connect's own rail.
 *
 * This is a component rather than a hook called in MainScreen's body for the
 * same reason HeaderUndoRedo is: MainScreen MOUNTS <UndoRedoHost> (its own body
 * therefore sits outside the Provider), so the context can only be read from a
 * component rendered inside the shell.
 *
 * Order: the row that OPENS a surface (the palette) reads first, then the rows
 * that act on what you just did (undo, redo).
 *
 * Undo/redo deliberately do NOT call `closeSheet` — undo repeats, and closing
 * on the first tap would turn a three-step undo into three reopens. The palette
 * row is the opposite case: it takes the user somewhere, so the sheet has to
 * be cleared out of the way first.
 *
 * Opening this sheet takes focus away from the body behind it, so these rows
 * always land on the unfocused rule: the body on screen and the app stack
 * compete, newer step first (D-20261008-main-3). That is what the header pair
 * does once the keyboard has closed, so the two never disagree. Before #2141
 * these rows drove the app stack alone and could not reach the body at all.
 */
export function MobileShellActions({
  onOpenPalette,
  closeSheet,
}: MobileShellActionsProps) {
  const { t } = useTranslation();
  const { undo, redo, canUndo, canRedo } = useLatestHistory();

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
        label={t("common.undo")}
        icon={<Undo2 size={18} />}
        onSelect={undo}
        disabled={!canUndo}
      />
      <BottomTabActionRow
        label={t("common.redo")}
        icon={<Redo2 size={18} />}
        onSelect={redo}
        disabled={!canRedo}
      />
    </>
  );
}
