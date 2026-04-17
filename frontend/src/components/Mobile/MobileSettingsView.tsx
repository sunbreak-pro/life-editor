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

export function MobileSettingsView() {
  const { t } = useTranslation();
  const { theme, setTheme, language, setLanguage } = useTheme();

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Theme */}
      <SettingsSection title={t("mobile.settings.theme", "Theme")}>
        <div className="flex gap-3 px-4 py-3">
          <ThemeOption
            icon={<Sun size={18} />}
            label={t("settings.theme.light", "Light")}
            isActive={theme === "light"}
            onClick={() => setTheme("light")}
          />
          <ThemeOption
            icon={<Moon size={18} />}
            label={t("settings.theme.dark", "Dark")}
            isActive={theme === "dark"}
            onClick={() => setTheme("dark")}
          />
        </div>
      </SettingsSection>

      {/* Language */}
      <SettingsSection title={t("mobile.settings.language", "Language")}>
        <div className="flex gap-3 px-4 py-3">
          <LanguageOption
            label="English"
            isActive={language === "en"}
            onClick={() => setLanguage("en" as Language)}
          />
          <LanguageOption
            label="日本語"
            isActive={language === "ja"}
            onClick={() => setLanguage("ja" as Language)}
          />
        </div>
      </SettingsSection>

      {/* Cloud Sync */}
      <MobileSyncSection />

      {/* Data Management */}
      <MobileDataSection />

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
      <div className="px-4 py-3 space-y-3">
        {isConnected ? (
          <>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm text-notion-text">
                {t("sync.connected", "Connected")}
              </span>
            </div>
            {status?.lastSyncedAt && (
              <p className="text-xs text-notion-text-secondary">
                {t("sync.lastSynced", "Last synced")}:{" "}
                {new Date(status.lastSyncedAt).toLocaleString()}
              </p>
            )}
            {lastSyncResult && (
              <p className="text-xs text-notion-text-secondary">
                {lastSyncResult.pushed} pushed, {lastSyncResult.pulled} pulled
              </p>
            )}
            {lastError && (
              <p className="text-xs text-notion-danger">
                {t("sync.lastError", "Last error")}: {lastError.message}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={triggerSync}
                disabled={isSyncing}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-notion-accent bg-notion-accent/10 py-2.5 text-sm font-medium text-notion-accent disabled:opacity-50"
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
                onClick={disconnect}
                className="flex items-center justify-center gap-2 rounded-xl border-2 border-notion-border px-4 py-2.5 text-sm text-notion-text-secondary active:bg-notion-hover"
              >
                <Unplug size={14} />
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
              className="w-full rounded-lg border border-notion-border bg-notion-bg px-3 py-2 text-sm text-notion-text"
            />
            <div className="relative">
              <input
                type={showToken ? "text" : "password"}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={t("sync.token", "Sync Token")}
                className="w-full rounded-lg border border-notion-border bg-notion-bg px-3 py-2 pr-10 text-sm text-notion-text"
              />
              <button
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-notion-text-secondary"
              >
                {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {configError && (
              <p className="text-xs text-notion-danger">{configError}</p>
            )}
            <button
              onClick={handleConnect}
              disabled={isConfiguring || !url || !token}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-notion-accent bg-notion-accent/10 py-2.5 text-sm font-medium text-notion-accent disabled:opacity-50"
            >
              <Cloud size={14} />
              {isConfiguring
                ? t("sync.connecting", "Connecting...")
                : t("sync.connect", "Connect")}
            </button>
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
      <div className="px-4 py-3 space-y-3">
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-notion-border py-2.5 text-sm text-notion-text-secondary active:bg-notion-hover"
          >
            <Download size={14} />
            {t("data.export", "Export")}
          </button>
          <button
            onClick={handleImport}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-notion-border py-2.5 text-sm text-notion-text-secondary active:bg-notion-hover"
          >
            <Upload size={14} />
            {t("data.import", "Import")}
          </button>
        </div>
        <p className="text-xs text-notion-text-secondary/60">
          {t("data.importWarning", "Import will replace all existing data.")}
        </p>
        {status && (
          <p
            className={`text-xs ${isError ? "text-notion-danger" : "text-green-500"}`}
          >
            {status}
          </p>
        )}
      </div>
    </SettingsSection>
  );
}

// --- Sub-components ---

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-notion-border">
      <div className="px-4 pt-4 pb-1">
        <span className="text-[11px] font-medium uppercase tracking-wider text-notion-text-secondary">
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function ThemeOption({
  icon,
  label,
  isActive,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-medium transition-colors ${
        isActive
          ? "border-notion-accent bg-notion-accent/10 text-notion-accent"
          : "border-notion-border text-notion-text-secondary active:bg-notion-hover"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function LanguageOption({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-medium transition-colors ${
        isActive
          ? "border-notion-accent bg-notion-accent/10 text-notion-accent"
          : "border-notion-border text-notion-text-secondary active:bg-notion-hover"
      }`}
    >
      <Globe size={16} />
      {label}
    </button>
  );
}
