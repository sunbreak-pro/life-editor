import { useState, useEffect, useCallback } from "react";
import { RefreshCw, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getDataService } from "../../services";
import type { IpcChannelMetrics, SystemInfo } from "../../types/diagnostics";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function msColor(ms: number): string {
  if (ms > 100) return "text-red-500";
  if (ms > 50) return "text-yellow-500";
  return "text-notion-text";
}

export function PerformanceMonitor() {
  const { t } = useTranslation();
  const [metrics, setMetrics] = useState<IpcChannelMetrics[]>([]);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [m, s] = await Promise.all([
        getDataService().fetchMetrics(),
        getDataService().fetchSystemInfo(),
      ]);
      setMetrics(m);
      setSystemInfo(s);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleReset = async () => {
    await getDataService().resetMetrics();
    await fetchData();
  };

  return (
    <div data-section-id="performance">
      <h3 className="text-lg font-semibold text-notion-text mb-3">
        {t("performance.title")}
      </h3>

      {systemInfo && (
        <div className="mb-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
          <InfoCard
            label={t("performance.appVersion")}
            value={`v${systemInfo.appVersion}`}
          />
          <InfoCard
            label={t("performance.dbSize")}
            value={formatBytes(systemInfo.dbSizeBytes)}
          />
          <InfoCard
            label={t("performance.memory")}
            value={formatBytes(systemInfo.memoryUsage.rss)}
          />
        </div>
      )}

      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1 rounded text-xs bg-notion-hover text-notion-text hover:bg-notion-border transition-colors"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          {t("performance.refresh")}
        </button>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1 rounded text-xs bg-notion-hover text-notion-text hover:bg-notion-border transition-colors"
        >
          <RotateCcw size={12} />
          {t("performance.resetMetrics")}
        </button>
        <span className="text-xs text-notion-text-secondary ml-auto">
          {t("performance.channelsTracked", { count: metrics.length })}
        </span>
      </div>

      <div className="bg-notion-bg-secondary rounded-lg border border-notion-border max-h-64 overflow-y-auto">
        {metrics.length === 0 ? (
          <p className="p-4 text-notion-text-secondary text-center text-xs">
            {t("performance.noMetrics")}
          </p>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-notion-bg-secondary">
              <tr className="border-b border-notion-border text-notion-text-secondary">
                <th className="text-left px-3 py-2 font-medium">
                  {t("performance.channel")}
                </th>
                <th className="text-right px-3 py-2 font-medium">
                  {t("performance.calls")}
                </th>
                <th className="text-right px-3 py-2 font-medium">
                  {t("performance.avg")}
                </th>
                <th className="text-right px-3 py-2 font-medium">
                  {t("performance.max")}
                </th>
                <th className="text-right px-3 py-2 font-medium">
                  {t("performance.total")}
                </th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => (
                <tr
                  key={m.channel}
                  className="border-b border-notion-border/50 last:border-0"
                >
                  <td className="px-3 py-1.5 text-notion-text font-mono">
                    {m.channel}
                  </td>
                  <td className="px-3 py-1.5 text-right text-notion-text">
                    {m.callCount}
                  </td>
                  <td
                    className={`px-3 py-1.5 text-right font-mono ${msColor(m.avgMs)}`}
                  >
                    {m.avgMs}
                  </td>
                  <td
                    className={`px-3 py-1.5 text-right font-mono ${msColor(m.maxMs)}`}
                  >
                    {m.maxMs}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-notion-text-secondary">
                    {m.totalMs}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {systemInfo && (
        <div className="mt-3">
          <p className="text-xs text-notion-text-secondary mb-1">
            {t("performance.dbTables")}
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(systemInfo.tableCounts).map(([table, count]) => (
              <span
                key={table}
                className="text-xs bg-notion-hover text-notion-text px-2 py-0.5 rounded"
              >
                {table}: {count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-notion-hover rounded-lg px-3 py-2">
      <p className="text-[10px] text-notion-text-secondary uppercase tracking-wider">
        {label}
      </p>
      <p className="text-sm font-medium text-notion-text">{value}</p>
    </div>
  );
}
