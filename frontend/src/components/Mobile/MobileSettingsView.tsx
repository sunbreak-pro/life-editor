import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import { Sun, Moon, Wifi, WifiOff, Globe, LogOut } from "lucide-react";
import { isApiConfigured, clearApiCredentials } from "../../config/api";
import type { Language } from "../../context/ThemeContextValue";

interface MobileSettingsViewProps {
  onDisconnect: () => void;
}

export function MobileSettingsView({ onDisconnect }: MobileSettingsViewProps) {
  const { t } = useTranslation();
  const { theme, setTheme, language, setLanguage } = useTheme();

  const isConnected = isApiConfigured();

  function handleDisconnect() {
    clearApiCredentials();
    onDisconnect();
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Connection */}
      <SettingsSection title={t("mobile.settings.connection", "Connection")}>
        <div className="flex items-center gap-3 px-4 py-3">
          {isConnected ? (
            <Wifi size={18} className="text-notion-success" />
          ) : (
            <WifiOff size={18} className="text-notion-text-secondary" />
          )}
          <span className="flex-1 text-sm text-notion-text-primary">
            {isConnected
              ? t("mobile.settings.connected", "Connected to desktop")
              : t("mobile.settings.disconnected", "Not connected")}
          </span>
          {isConnected && (
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-1.5 rounded-lg border border-notion-danger/30 px-3 py-1.5 text-xs text-notion-danger active:opacity-70"
            >
              <LogOut size={12} />
              {t("mobile.settings.disconnect", "Disconnect")}
            </button>
          )}
        </div>
      </SettingsSection>

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

      {/* App info */}
      <div className="mt-auto px-4 py-6 text-center">
        <p className="text-xs text-notion-text-secondary/60">
          Life Editor Mobile
        </p>
      </div>
    </div>
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
