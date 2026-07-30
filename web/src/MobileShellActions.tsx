import { Undo2, Redo2 } from "lucide-react";
import {
  BottomTabActionRow,
  useTranslation,
  useUndoRedoContext,
} from "@life-editor/shared";

/*
 * MobileShellActions (#472) — the app-global rows the narrow bottom bar's
 * "More" sheet carries.
 *
 * Why here: the wide layout puts undo/redo in the header slot (see
 * HeaderUndoRedo), and AppShell renders `header` on its WIDE branch only, so
 * the narrow layout had no path to the history at all. The keyboard route is no
 * help either — GlobalShortcuts' ⌘Z needs the ShortcutConfig Provider, which
 * native mobile deliberately skips (CLAUDE.md §2). The "More" sheet is the only
 * chrome every narrow section shares, which is why these land there.
 *
 * The history stays ONE global stack (#304's design): this reads the very same
 * UndoRedoContext the header buttons read — no per-surface fork.
 *
 * This is a component rather than a hook called in MainScreen's body for the
 * same reason HeaderUndoRedo is: MainScreen MOUNTS <UndoRedoHost> (its own body
 * therefore sits outside the Provider), so the context can only be read from a
 * component rendered inside the shell. Rows deliberately do NOT call
 * `closeSheet` — undo repeats, and closing on the first tap would turn a
 * three-step undo into three reopens.
 */
export function MobileShellActions() {
  const { t } = useTranslation();
  const { undo, redo, canUndo, canRedo } = useUndoRedoContext();

  return (
    <>
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
