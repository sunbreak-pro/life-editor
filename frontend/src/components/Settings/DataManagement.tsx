import { useState } from "react";
import { Download, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getDataService } from "../../services";

export function DataManagement() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

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
    </div>
  );
}
