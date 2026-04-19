import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import { useSyncContext } from "../../hooks/useSyncContext";
import { getDataService } from "../../services";
import {
  Sun,
  Moon,
  Globe,
  Cloud,
  RefreshCw,
  Unplug,
  Eye,
  EyeOff,
  Download,
  Upload,
} from "lucide-react";
import type { Language } from "../../context/ThemeContextValue";
import {
  CompactButton,
  PillOption,
  SettingsSection,
} from "./settings/MobileSettingsPrimitives";
import { MobileFontSizeSection } from "./settings/MobileFontSizeSection";
import { MobileTimerSection } from "./settings/MobileTimerSection";
import { MobileNotificationsSection } from "./settings/MobileNotificationsSection";
import { MobileTrashSection } from "./settings/MobileTrashSection";

export function MobileSettingsView() {
  const { t } = useTranslation();
  const { theme, setTheme, language, setLanguage } = useTheme();

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Theme */}
      <SettingsSection title={t("mobile.settings.theme", "Theme")}>
        <div className="flex gap-2 px-4 py-2.5">
          <PillOption
            icon={<Sun size={14} />}
            label={t("settings.theme.light", "Light")}
            isActive={theme === "light"}
            onClick={() => setTheme("light")}
          />
          <PillOption
            icon={<Moon size={14} />}
            label={t("settings.theme.dark", "Dark")}
            isActive={theme === "dark"}
            onClick={() => setTheme("dark")}
          />
        </div>
      </SettingsSection>

      {/* Font Size */}
      <MobileFontSizeSection />

      {/* Language */}
      <SettingsSection title={t("mobile.settings.language", "Language")}>
        <div className="flex gap-2 px-4 py-2.5">
          <PillOption
            icon={<Globe size={14} />}
            label="English"
            isActive={language === "en"}
            onClick={() => setLanguage("en" as Language)}
          />
          <PillOption
            icon={<Globe size={14} />}
            label="日本語"
            isActive={language === "ja"}
            onClick={() => setLanguage("ja" as Language)}
          />
        </div>
      </SettingsSection>

      {/* Notifications */}
      <MobileNotificationsSection />

      {/* Timer defaults */}
      <MobileTimerSection />

      {/* Cloud Sync */}
      <MobileSyncSection />

      {/* Data Management */}
      <MobileDataSection />

      {/* Trash */}
      <MobileTrashSection />

      {/* App info */}
      <div className="mt-auto px-4 py-6 text-center">
        <p className="text-xs text-notion-text-secondary/60">
          Life Editor Mobile
        </p>
      </div>
    </div>
  );
}

function MobileSyncSection() {
  const { t } = useTranslation();
  const {
    status,
    lastSyncResult,
    lastError,
    isSyncing,
    triggerSync,
    configure,
    disconnect,
  } = useSyncContext();
  const [url, setUrl] = useState(status?.url ?? "");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [isConfiguring, setIsConfiguring] = useState(false);

  const isConnected = status?.enabled === true;

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

  return (
    <SettingsSection title={t("sync.title", "Cloud Sync")}>
      <div className="space-y-2 px-4 py-2.5">
        {isConnected ? (
          <>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-[13px] text-notion-text">
                {t("sync.connected", "Connected")}
              </span>
            </div>
            {status?.lastSyncedAt && (
              <p className="text-[11px] text-notion-text-secondary">
                {t("sync.lastSynced", "Last synced")}:{" "}
                {new Date(status.lastSyncedAt).toLocaleString()}
              </p>
            )}
            {lastSyncResult && (
              <p className="text-[11px] text-notion-text-secondary">
                {lastSyncResult.pushed} pushed, {lastSyncResult.pulled} pulled
              </p>
            )}
            {lastError && (
              <p className="text-[11px] text-notion-danger">
                {t("sync.lastError", "Last error")}: {lastError.message}
              </p>
            )}
            <div className="flex gap-1.5">
              <CompactButton
                icon={
                  <RefreshCw
                    size={12}
                    className={isSyncing ? "animate-spin" : ""}
                  />
                }
                label={
                  isSyncing
                    ? t("sync.syncing", "Syncing...")
                    : t("sync.syncNow", "Sync Now")
                }
                onClick={triggerSync}
                disabled={isSyncing}
                variant="accent"
              />
              <button
                onClick={disconnect}
                aria-label={t("sync.disconnect", "Disconnect")}
                className="flex items-center justify-center rounded-lg border border-notion-border px-3 py-2 text-notion-text-secondary active:bg-notion-hover"
              >
                <Unplug size={12} />
              </button>
            </div>
          </>
        ) : (
          <>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t("sync.cloudUrl", "Cloud URL")}
              className="w-full rounded-lg border border-notion-border bg-notion-bg px-3 py-2 text-[13px] text-notion-text"
            />
            <div className="relative">
              <input
                type={showToken ? "text" : "password"}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={t("sync.token", "Sync Token")}
                className="w-full rounded-lg border border-notion-border bg-notion-bg px-3 py-2 pr-10 text-[13px] text-notion-text"
              />
              <button
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-notion-text-secondary"
              >
                {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {configError && (
              <p className="text-[11px] text-notion-danger">{configError}</p>
            )}
            <CompactButton
              icon={<Cloud size={12} />}
              label={
                isConfiguring
                  ? t("sync.connecting", "Connecting...")
                  : t("sync.connect", "Connect")
              }
              onClick={handleConnect}
              disabled={isConfiguring || !url || !token}
              variant="accent"
            />
          </>
        )}
      </div>
    </SettingsSection>
  );
}

function MobileDataSection() {
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
    <SettingsSection title={t("data.title", "Data")}>
      <div className="space-y-2 px-4 py-2.5">
        <div className="flex gap-1.5">
          <CompactButton
            icon={<Download size={12} />}
            label={t("data.export", "Export")}
            onClick={handleExport}
          />
          <CompactButton
            icon={<Upload size={12} />}
            label={t("data.import", "Import")}
            onClick={handleImport}
          />
        </div>
        <p className="text-[10px] text-notion-text-secondary/60">
          {t("data.importWarning", "Import will replace all existing data.")}
        </p>
        {status && (
          <p
            className={`text-[11px] ${isError ? "text-notion-danger" : "text-green-500"}`}
          >
            {status}
          </p>
        )}
      </div>
    </SettingsSection>
  );
}
