import { useEffect, useState } from "react";
import { i18n, useTranslation } from "@life-editor/shared";
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
 */
export function LegalReaderHost() {
  const { t } = useTranslation();
  const [activeDocument, setActiveDocument] = useState<LegalDocumentId | null>(
    readLegalParam,
  );

  useEffect(
    () => subscribeLegalParam(() => setActiveDocument(readLegalParam())),
    [],
  );

  if (!activeDocument) return null;

  return (
    // z-50 is the app's top layer (modals, sheets). Nothing else should be
    // open behind this: it is reached from a link, not from inside a dialog.
    <div className="fixed inset-0 z-50 overflow-y-auto bg-lumen-bg">
      <LegalView
        document={legalDocument(activeDocument, i18n.language)}
        backLabel={t("auth.legal.back")}
        updatedLabel={t("auth.legal.updated")}
        onBack={() => openLegalDocument(null)}
      />
    </div>
  );
}
