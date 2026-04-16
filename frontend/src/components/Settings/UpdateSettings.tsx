import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Download, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getDataService } from "../../services";
import { onUpdaterStatus } from "../../services/events";
import type { UpdaterStatus } from "../../types/updater";

export function UpdateSettings() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<UpdaterStatus | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    onUpdaterStatus((s: UpdaterStatus) => {
      setStatus(s);
      if (s.event !== "checking") setChecking(false);
    }).then((unlisten) => {
      if (disposed) {
        unlisten();
      } else {
        cleanup = unlisten;
      }
    });
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  const handleCheck = useCallback(async () => {
    setChecking(true);
    try {
      await getDataService().checkForUpdates();
    } catch {
      setChecking(false);
    }
  }, []);

  const handleDownload = useCallback(async () => {
    await getDataService().downloadUpdate();
  }, []);

  const handleInstall = useCallback(async () => {
    await getDataService().installUpdate();
  }, []);

  const statusText = () => {
    if (!status) return null;
    switch (status.event) {
      case "checking":
        return t("updates.checking");
      case "available":
        return t("updates.available", { version: status.data?.version });
      case "not-available":
        return t("updates.upToDate");
      case "downloading":
        return t("updates.downloading", { percent: status.data?.percent ?? 0 });
      case "downloaded":
        return t("updates.downloaded", { version: status.data?.version });
      case "error":
        return t("updates.error", {
          message: status.data?.message ?? t("updates.unknown"),
        });
      default:
        return null;
    }
  };

  return (
    <div data-section-id="updates">
      <h3 className="text-lg font-semibold text-notion-text mb-3">
        {t("updates.title")}
      </h3>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <button
            onClick={handleCheck}
            disabled={checking}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm bg-notion-hover text-notion-text hover:bg-notion-border transition-colors"
          >
            <RefreshCw size={16} className={checking ? "animate-spin" : ""} />
            {t("updates.checkForUpdates")}
          </button>

          {status?.event === "available" && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm bg-notion-primary text-white hover:opacity-90 transition-opacity"
            >
              <Download size={16} />
              {t("updates.download")}
            </button>
          )}

          {status?.event === "downloaded" && (
            <button
              onClick={handleInstall}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm bg-notion-primary text-white hover:opacity-90 transition-opacity"
            >
              <RotateCcw size={16} />
              {t("updates.restartToUpdate")}
            </button>
          )}
        </div>

        {status?.event === "downloading" && (
          <div className="w-full bg-notion-hover rounded-full h-2">
            <div
              className="bg-notion-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${status.data?.percent ?? 0}%` }}
            />
          </div>
        )}

        {statusText() && (
          <p
            className={`text-sm ${status?.event === "error" ? "text-notion-danger" : "text-notion-text-secondary"}`}
          >
            {statusText()}
          </p>
        )}
      </div>
    </div>
  );
}
