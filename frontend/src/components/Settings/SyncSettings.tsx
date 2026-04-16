import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Cloud, RefreshCw, Unplug, Eye, EyeOff, Download } from "lucide-react";
import { useSyncContext } from "../../hooks/useSyncContext";

const DEFAULT_CLOUD_URL =
  "https://life-editor-sync.<your-subdomain>.workers.dev";

export function SyncSettings() {
  const { t } = useTranslation();
  const {
    status,
    lastSyncResult,
    isSyncing,
    triggerSync,
    configure,
    disconnect,
    fullDownload,
  } = useSyncContext();

  const [url, setUrl] = useState(status?.url ?? DEFAULT_CLOUD_URL);
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [isConfiguring, setIsConfiguring] = useState(false);

  const handleConnect = async () => {
    setConfigError(null);
    setIsConfiguring(true);
    try {
      const ok = await configure(url, token);
      if (!ok) setConfigError(t("sync.connectFailed", "Connection failed"));
      else setToken("");
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsConfiguring(false);
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    setToken("");
    setConfigError(null);
  };

  const isConnected = status?.enabled === true;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Cloud size={18} className="text-notion-text-secondary" />
        <h3 className="text-base font-semibold text-notion-text">
          {t("sync.title", "Cloud Sync")}
        </h3>
      </div>

      {isConnected ? (
        <>
          {/* Status */}
          <div className="rounded-lg border border-notion-border bg-notion-bg-secondary p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm font-medium text-notion-text">
                {t("sync.connected", "Connected")}
              </span>
            </div>
            {status?.url && (
              <div className="text-xs text-notion-text-secondary truncate">
                {status.url}
              </div>
            )}
            {status?.lastSyncedAt && (
              <div className="text-xs text-notion-text-secondary">
                {t("sync.lastSynced", "Last synced")}:{" "}
                {new Date(status.lastSyncedAt).toLocaleString()}
              </div>
            )}
            {status?.deviceId && (
              <div className="text-xs text-notion-text-secondary">
                {t("sync.deviceId", "Device ID")}: {status.deviceId.slice(0, 8)}
                ...
              </div>
            )}
            {lastSyncResult && (
              <div className="text-xs text-notion-text-secondary">
                {t("sync.lastResult", "Last result")}: {lastSyncResult.pushed}{" "}
                pushed, {lastSyncResult.pulled} pulled
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={triggerSync}
              disabled={isSyncing}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm bg-notion-accent/10 text-notion-accent hover:bg-notion-accent/20 transition-colors disabled:opacity-50"
            >
              <RefreshCw
                size={14}
                className={isSyncing ? "animate-spin" : ""}
              />
              {isSyncing
                ? t("sync.syncing", "Syncing...")
                : t("sync.syncNow", "Sync Now")}
            </button>
            <button
              onClick={fullDownload}
              disabled={isSyncing}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm bg-notion-bg-secondary text-notion-text-secondary hover:bg-notion-hover transition-colors disabled:opacity-50"
            >
              <Download size={14} />
              {t("sync.fullResync", "Full Re-sync")}
            </button>
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm bg-notion-danger/10 text-notion-danger hover:bg-notion-danger/20 transition-colors"
            >
              <Unplug size={14} />
              {t("sync.disconnect", "Disconnect")}
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Configuration form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-notion-text-secondary mb-1">
                {t("sync.cloudUrl", "Cloud URL")}
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={DEFAULT_CLOUD_URL}
                className="w-full px-3 py-2 rounded-md border border-notion-border bg-notion-bg text-sm text-notion-text focus:outline-none focus:border-notion-accent"
              />
            </div>
            <div>
              <label className="block text-sm text-notion-text-secondary mb-1">
                {t("sync.token", "Sync Token")}
              </label>
              <div className="relative">
                <input
                  type={showToken ? "text" : "password"}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder={t(
                    "sync.tokenPlaceholder",
                    "Enter your sync token",
                  )}
                  className="w-full px-3 py-2 pr-10 rounded-md border border-notion-border bg-notion-bg text-sm text-notion-text focus:outline-none focus:border-notion-accent"
                />
                <button
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-notion-text-secondary hover:text-notion-text"
                >
                  {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {configError && (
              <p className="text-xs text-notion-danger">{configError}</p>
            )}
            <button
              onClick={handleConnect}
              disabled={isConfiguring || !url || !token}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm bg-notion-accent text-white hover:bg-notion-accent/90 transition-colors disabled:opacity-50"
            >
              <Cloud size={14} />
              {isConfiguring
                ? t("sync.connecting", "Connecting...")
                : t("sync.connect", "Connect")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
