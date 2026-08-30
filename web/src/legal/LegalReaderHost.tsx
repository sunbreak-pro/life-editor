import { useCallback, useEffect, useId, useState } from "react";
import { i18n, useDialogA11y, useTranslation } from "@life-editor/shared";
import { LegalView } from "./LegalView";
import { legalDocument, type LegalDocumentId } from "./legalContent";
import {
  readLegalParam,
  openLegalDocument,
  subscribeLegalParam,
} from "./legalUrl";

/*
 * The one place the policy and the terms are rendered (#1251).
 *
 * It is mounted in App, ABOVE the session gate, which is the point: before
 * #1251 the reader lived inside AuthScreen, so the documents vanished the
 * moment you signed in and `?legal=privacy` was swallowed by the gate. Terms
 * you can only read while signed out are terms you cannot check when you
 * finally have a reason to.
 *
 * It overlays rather than replaces — the app underneath stays mounted, so
 * reading the policy mid-sentence does not cost the section you were in or
 * the note you were typing. It reads its state from the URL (legalUrl.ts) and
 * needs nothing passed down, which is why Settings can open it from four
 * levels below without a single new prop on the way.
 *
 * It is a dialog, not just a div on top (#1281). The first version looked
 * modal and behaved like a sheet of paper laid over the desk: focus stayed on
 * the Settings button underneath, one Tab walked a keyboard user into the
 * invisible app behind it, and Escape did nothing. `useDialogA11y` — the same
 * hook as Modal and BottomSheet — gives it initial focus, the Tab trap, Escape
 * and the return of focus to whatever opened it. The back button is handled by
 * legalUrl.ts: opening pushes a history entry, so back (and Escape, which is
 * the same step back) closes the reader rather than leaving the app.
 */
export function LegalReaderHost() {
  const { t } = useTranslation();
  const [activeDocument, setActiveDocument] = useState<LegalDocumentId | null>(
    readLegalParam,
  );
  const titleId = useId();

  useEffect(
    () => subscribeLegalParam(() => setActiveDocument(readLegalParam())),
    [],
  );

  const close = useCallback(() => openLegalDocument(null), []);
  const panelRef = useDialogA11y<HTMLDivElement>({
    open: activeDocument !== null,
    onClose: close,
    lockScroll: true,
  });

  if (!activeDocument) return null;

  return (
    // z-50 is the app's top layer (modals, sheets). Nothing else should be
    // open behind this: it is reached from a link, not from inside a dialog.
    // tabIndex={-1} lets the panel hold focus itself (useDialogA11y's
    // fallback) — a document is mostly plain text.
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      className="fixed inset-0 z-50 overflow-y-auto bg-lumen-bg outline-none"
    >
      <LegalView
        document={legalDocument(activeDocument, i18n.language)}
        titleId={titleId}
        backLabel={t("auth.legal.back")}
        updatedLabel={t("auth.legal.updated")}
        onBack={close}
      />
    </div>
  );
}
