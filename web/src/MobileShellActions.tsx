import { Undo2, Redo2 } from "lucide-react";
import { BottomTabActionRow, useTranslation } from "@life-editor/shared";
import { useLatestHistory } from "./useLatestHistory";

/*
 * MobileShellActions (#472) — the app-global rows the narrow bottom bar's
 * "More" sheet carries.
 *
 * Why here: the wide layout puts undo/redo in the header slot (see
 * HeaderUndoRedo), and AppShell renders `header` on its WIDE branch only, so
 * the narrow layout had no path to it. The keyboard route is no help on a
 * phone, which has no keyboard for GlobalShortcuts' ⌘Z. The "More" sheet is
 * the only chrome every narrow section shares, which is why these land there.
 *
 * Undo / redo call the very same function the header buttons call
 * (`useLatestHistory` → `undoLatest`, #2141) — no per-surface fork.
 *
 * There is no tag row any more (#1851). #1290 added "Edit tags" here because a
 * phone had no way to reach the tag master; #1643 then retired the master into
 * the Connect section and pointed the row at it — which the same sheet already
 * lists as a section, so the two rows landed on the identical screen. Tags are
 * edited from Connect's own rail. The search row that opened the command
 * palette went with the palette (#2719).
 *
 * This is a component rather than a hook called in MainScreen's body for the
 * same reason HeaderUndoRedo is: MainScreen MOUNTS <UndoRedoHost> (its own body
 * therefore sits outside the Provider), so the context can only be read from a
 * component rendered inside the shell.
 *
 * Undo/redo deliberately do NOT close the sheet — undo repeats, and closing on
 * the first tap would turn a three-step undo into three reopens.
 *
 * Opening this sheet takes focus away from the body behind it, so these rows
 * always land on the unfocused rule: the body on screen and the app stack
 * compete, newer step first (D-20261008-main-3). That is what the header pair
 * does once the keyboard has closed, so the two never disagree. Before #2141
 * these rows drove the app stack alone and could not reach the body at all.
 */
export function MobileShellActions(): React.JSX.Element {
  const { t } = useTranslation();
  const { undo, redo, canUndo, canRedo } = useLatestHistory();

  return (
    <>
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
