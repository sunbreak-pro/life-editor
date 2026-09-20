import type { ReactNode } from "react";
import {
  NotesUnifiedProvider,
  useToast,
  useTranslation,
  type DataService,
  type NoteWriteOp,
} from "@life-editor/shared";

/*
 * NotesUnifiedHost (#1761) — binds the shared Notes provider to the app's
 * toast surface, the same shape as UndoRedoHost.
 *
 * Notes writes are optimistic: the list changes first and the request follows.
 * A delete killed by a dropped connection therefore looked like a button that
 * did nothing — the row came back, the only trace was a `console.warn`, and
 * the user's reasonable read was "it's broken". Now the provider names the
 * operation that failed and we say it out loud.
 *
 * This lives in web rather than in the provider because the copy has to be
 * translated and shared UI takes its strings from the host (§6.4). It is a
 * component rather than a few lines inside the section descriptor because
 * `SECTION_DESCRIPTORS[...].body` is CALLED as a plain function — hooks are
 * not allowed in there.
 */

/*
 * One line per failed operation instead of a single "couldn't save": the two
 * that actually strand the user (a delete that did not delete, a restore that
 * did not restore) read as a no-op button otherwise, and a generic sentence
 * would not tell them which of the things they just did is the one that
 * didn't take.
 *
 * `as const satisfies` rather than a plain `Record<NoteWriteOp, string>`: the
 * values have to stay literal for i18next's typed `t()` to accept them, which
 * is what turns a mistyped key into a build error instead of a raw key shown
 * to the user at the worst possible moment. The `satisfies` half still forces
 * a new NoteWriteOp to be given copy here.
 */
const WRITE_FAILED_COPY = {
  create: "notesView.writeFailed.create",
  update: "notesView.writeFailed.update",
  delete: "notesView.writeFailed.delete",
  pin: "notesView.writeFailed.pin",
  restore: "notesView.writeFailed.restore",
  permanentDelete: "notesView.writeFailed.permanentDelete",
} as const satisfies Record<NoteWriteOp, string>;

export { WRITE_FAILED_COPY };

export function NotesUnifiedHost({
  dataService,
  children,
}: {
  dataService: DataService;
  children: ReactNode;
}) {
  const { showToast } = useToast();
  const { t } = useTranslation();
  return (
    <NotesUnifiedProvider
      dataService={dataService}
      onWriteError={(operation) =>
        showToast("danger", t(WRITE_FAILED_COPY[operation]))
      }
    >
      {children}
    </NotesUnifiedProvider>
  );
}
