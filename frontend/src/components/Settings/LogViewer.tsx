import { useState, useEffect, useCallback } from "react";
import { RefreshCw, FolderOpen, Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getDataService } from "../../services";
import type { LogEntry } from "../../types/diagnostics";

const LEVEL_COLORS: Record<string, string> = {
  error: "text-red-500",
  warn: "text-yellow-500",
  info: "text-blue-400",
  verbose: "text-notion-text-secondary",
  debug: "text-notion-text-secondary",
  silly: "text-notion-text-secondary",
};

const LEVEL_FILTER_KEYS = ["all", "error", "warn", "info"] as const;

export function LogViewer() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [level, setLevel] = useState<string>("all");
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const entries = await getDataService().fetchLogs({
        level: level === "all" ? undefined : level,
        limit: 200,
      });
      setLogs(entries);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [level]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleOpenFolder = async () => {
    await getDataService().openLogFolder();
  };

  const handleExport = async () => {
    await getDataService().exportLogs();
  };

  return (
    <div data-section-id="logs">
      <h3 className="text-lg font-semibold text-notion-text mb-3">
        {t("logs.title")}
      </h3>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {LEVEL_FILTER_KEYS.map((f) => (
          <button
            key={f}
            onClick={() => setLevel(f)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              level === f
                ? "bg-notion-primary text-white"
                : "bg-notion-hover text-notion-text-secondary hover:bg-notion-border"
            }`}
          >
            {t(`logs.${f}`)}
          </button>
        ))}

        <div className="flex-1" />

        <button
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1 rounded text-xs bg-notion-hover text-notion-text hover:bg-notion-border transition-colors"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          {t("logs.refresh")}
        </button>
        <button
          onClick={handleOpenFolder}
          className="flex items-center gap-1.5 px-3 py-1 rounded text-xs bg-notion-hover text-notion-text hover:bg-notion-border transition-colors"
        >
          <FolderOpen size={12} />
          {t("logs.openFolder")}
        </button>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1 rounded text-xs bg-notion-hover text-notion-text hover:bg-notion-border transition-colors"
        >
          <Download size={12} />
          {t("logs.export")}
        </button>
      </div>

      <div className="bg-notion-bg-secondary rounded-lg border border-notion-border max-h-64 overflow-y-auto font-mono text-xs">
        {logs.length === 0 ? (
          <p className="p-4 text-notion-text-secondary text-center">
            {loading ? t("logs.loading") : t("logs.noEntries")}
          </p>
        ) : (
          <table className="w-full">
            <tbody>
              {logs.map((entry, i) => (
                <tr
                  key={i}
                  className="border-b border-notion-border/50 last:border-0"
                >
                  <td className="px-2 py-1 text-notion-text-secondary whitespace-nowrap align-top">
                    {entry.timestamp}
                  </td>
                  <td
                    className={`px-2 py-1 whitespace-nowrap align-top font-semibold uppercase ${LEVEL_COLORS[entry.level] ?? "text-notion-text"}`}
                  >
                    {entry.level}
                  </td>
                  <td className="px-2 py-1 text-notion-text break-all">
                    {entry.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
