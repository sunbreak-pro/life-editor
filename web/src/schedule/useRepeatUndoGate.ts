import { useEffect } from "react";
import {
  useTranslation,
  useUndoRedoOptional,
  type ConfirmRequest,
  type UndoConfirmSpec,
} from "@life-editor/shared";

/*
 * The question in front of an Undo / Redo that touches a repeating item
 * (#1638, ユーザー指定).
 *
 * Undo is a keystroke, and a command that was applied to a series reverses
 * days that are not on screen — "how many of them" is exactly what the user
 * cannot tell from the calendar. So the commands that carry a scope
 * (useScheduleItemsCRUD / useRoutinesAPI / useRepeatMutations tag them) pass
 * through this gate first, and a cancel leaves the history untouched.
 *
 * Registered while Schedule is mounted and cleared on the way out: the gate is
 * global (one stack, app-wide), and a dialog belonging to a screen that is no
 * longer there could never be answered. With no gate registered the commands
 * simply run — reversible everywhere, asked about here.
 *
 * The same ConfirmDialog the scope chooser and the delete guards use, rather
 * than RepeatScopeDialog: that one asks the user to PICK a scope, while this
 * one only reports the scope the original edit already chose.
 */

// `as const` so each value stays the literal key `t` knows: the catalog is
// typed, and a widened `string` is rejected at the call below.
const SCOPE_KEY = {
  this: "scheduleScreen.undoRepeatScopeThis",
  future: "scheduleScreen.undoRepeatScopeFuture",
  all: "scheduleScreen.undoRepeatScopeAll",
} as const satisfies Record<UndoConfirmSpec["scope"], string>;

export function useRepeatUndoGate(
  askConfirm: (request: ConfirmRequest) => Promise<boolean>,
): void {
  const { t } = useTranslation();
  const undoRedo = useUndoRedoOptional();

  useEffect(() => {
    if (!undoRedo) return;
    undoRedo.setConfirmGate(({ direction, confirm }) =>
      askConfirm({
        message: `${t(
          direction === "undo"
            ? "scheduleScreen.undoRepeatTitle"
            : "scheduleScreen.redoRepeatTitle",
        )}\n${t(SCOPE_KEY[confirm.scope])}`,
        confirmLabel: t(
          direction === "undo"
            ? "scheduleScreen.undoRepeatConfirm"
            : "scheduleScreen.redoRepeatConfirm",
        ),
        cancelLabel: t("common.cancel"),
      }),
    );
    return () => undoRedo.setConfirmGate(null);
    // `undoRedo`'s identity changes on every stack mutation (the provider
    // re-memoises on `version`), which would re-register the gate after each
    // push. Harmless — setConfirmGate only stores the function — and the
    // alternative is a ref dance for no gain.
  }, [undoRedo, askConfirm, t]);
}
