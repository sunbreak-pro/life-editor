import { useState } from "react";
import { Download, Upload, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getDataService } from "../../services";
import { ConfirmDialog } from "../shared/ConfirmDialog";

export function DataManagement() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleExport = async () => {
    try {
      const success = await getDataService().exportData();
      setIsError(false);
      setStatus(success ? t("data.exportSuccess") : null);
    } catch (e) {
      setIsError(true);
      setStatus(
        t("data.exportFailed", {
          error: e instanceof Error ? e.message : t("data.unknownError"),
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
          error: e instanceof Error ? e.message : t("data.unknownError"),
        }),
      );
    }
  };

  const handleReset = async () => {
    setShowResetConfirm(false);
    try {
      const success = await getDataService().resetData();
      if (success) {
        setIsError(false);
        setStatus(t("data.resetSuccess"));
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (e) {
      setIsError(true);
      setStatus(
        t("data.resetFailed", {
          error: e instanceof Error ? e.message : t("data.unknownError"),
        }),
      );
    }
  };

  return (
    <div>
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

        <div className="border-t border-notion-border pt-3 mt-3">
          <button
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm bg-notion-danger/10 text-notion-danger hover:bg-notion-danger/20 transition-colors"
          >
            <Trash2 size={16} />
            {t("data.reset")}
          </button>
        </div>

        {status && (
          <p
            className={`text-sm ${isError ? "text-notion-danger" : "text-notion-success"}`}
          >
            {status}
          </p>
        )}
      </div>

      {showResetConfirm && (
        <ConfirmDialog
          message={t("data.resetConfirm")}
          onConfirm={handleReset}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}
    </div>
  );
}
