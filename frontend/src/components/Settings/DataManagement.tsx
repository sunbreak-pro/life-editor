import { useState } from "react";
import { Download, Upload, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getDataService } from "../../services";
import { getErrorMessage } from "../../utils/logError";
import { CalendarDataResetDialog } from "./CalendarDataResetDialog";
import type { BulkSoftDeleteResult } from "../../services/DataService";

export function DataManagement() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const handleExport = async () => {
    try {
      const success = await getDataService().exportData();
      setIsError(false);
      setStatus(success ? t("data.exportSuccess") : null);
    } catch (e) {
      setIsError(true);
      setStatus(
        t("data.exportFailed", {
          error: getErrorMessage(e, t("data.unknownError")),
        }),
      );
    }
  };

  const handleImport = async () => {
    try {
      const success = await getDataService().importData();
      if (success) {
        setIsError(false);
        setStatus(t("data.importSuccess"));
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (e) {
      setIsError(true);
      setStatus(
        t("data.importFailed", {
          error: getErrorMessage(e, t("data.unknownError")),
        }),
      );
    }
  };

  const handleBulkDeleted = (result: BulkSoftDeleteResult) => {
    setResetMessage(
      t("settings.calendarReset.success", {
        tasks: result.tasks,
        events: result.events,
        routines: result.routines,
        cascaded: result.cascadedScheduleItems,
        dailies: result.dailies,
        notes: result.notes,
      }),
    );
    // Reload so every Context (TaskTree / Routine / Schedule / Daily / Note)
    // re-fetches from the now-updated DB. This mirrors the existing
    // import/reset flows (Settings.tsx:232, DataManagement.tsx:32).
    setTimeout(() => window.location.reload(), 1200);
  };

  return (
    <div data-section-id="data">
      <h3 className="text-lg font-semibold text-notion-text mb-3">
        {t("data.title")}
      </h3>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm bg-notion-hover text-notion-text hover:bg-notion-border transition-colors"
          >
            <Download size={16} />
            {t("data.export")}
          </button>

          <button
            onClick={handleImport}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm bg-notion-hover text-notion-text hover:bg-notion-border transition-colors"
          >
            <Upload size={16} />
            {t("data.import")}
          </button>
        </div>

        <p className="text-xs text-notion-text-secondary">
          {t("data.importWarning")}
        </p>

        {status && (
          <p
            className={`text-sm ${isError ? "text-notion-danger" : "text-notion-success"}`}
          >
            {status}
          </p>
        )}
      </div>

      {/* Danger Zone — bulk soft-delete Calendar-visible data */}
      <div className="mt-8 border-t border-notion-border pt-6">
        <h4 className="flex items-center gap-2 text-base font-semibold text-notion-danger mb-2">
          <AlertTriangle size={16} aria-hidden="true" />
          {t("settings.calendarReset.title")}
        </h4>
        <p className="text-xs text-notion-text-secondary mb-3">
          {t("settings.calendarReset.description")}
        </p>
        <button
          type="button"
          onClick={() => {
            setResetMessage(null);
            setResetDialogOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-md text-sm bg-notion-danger/10 text-notion-danger hover:bg-notion-danger/20 transition-colors"
        >
          <AlertTriangle size={14} />
          {t("settings.calendarReset.openButton")}
        </button>
        {resetMessage && (
          <p className="text-sm text-notion-success mt-3">{resetMessage}</p>
        )}
      </div>

      <CalendarDataResetDialog
        open={resetDialogOpen}
        onClose={() => setResetDialogOpen(false)}
        onDeleted={handleBulkDeleted}
      />
    </div>
  );
}
