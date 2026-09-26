import { useCallback, useState } from "react";
import {
  SettingsDataExport,
  countUserDataExportRows,
  useTranslation,
  userDataExportFileName,
  type DataService,
} from "@life-editor/shared";
import { saveJsonFile } from "./saveJsonFile";

/*
 * Web host for the whole-account export (#1988): calls the injected
 * DataService, names the file, saves it, and hands the pure card finished
 * strings (§6.4).
 *
 * `dataService` may be null — Settings builds it once and catches the
 * synchronous throw of a client with no credentials. The card still shows
 * then, and a press says it could not prepare the file, which is true and is
 * more use than a card that silently is not there.
 *
 * `save` is injectable so the suite can see the file without a real
 * download; the app always uses `saveJsonFile`.
 */

interface DataExportCardProps {
  dataService: DataService | null;
  save?: (fileName: string, value: unknown) => void;
  now?: () => Date;
}

export function DataExportCard({
  dataService,
  save = saveJsonFile,
  now = () => new Date(),
}: DataExportCardProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      if (!dataService) throw new Error("no data service");
      const data = await dataService.exportUserData();
      const fileName = userDataExportFileName(now());
      save(fileName, data);
      setNotice(
        t("settings.dataExport.done", {
          rows: countUserDataExportRows(data).toLocaleString(),
          file: fileName,
        }),
      );
    } catch (e: unknown) {
      console.error("[settings] exportUserData", e);
      setError(t("settings.dataExport.error"));
    } finally {
      setBusy(false);
    }
  }, [busy, dataService, now, save, t]);

  return (
    <SettingsDataExport
      onExport={() => void handleExport()}
      busy={busy}
      notice={notice}
      error={error}
      labels={{
        heading: t("settings.dataExport.heading"),
        description: t("settings.dataExport.description"),
        button: t("settings.dataExport.button"),
        busy: t("settings.dataExport.busy"),
      }}
    />
  );
}
