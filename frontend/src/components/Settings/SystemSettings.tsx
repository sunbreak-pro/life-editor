import { useState, useCallback, useEffect } from "react";
import { Power, Minimize2, AppWindow, Keyboard } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getDataService } from "../../services/dataServiceFactory";

export function SystemSettings() {
  const { t } = useTranslation();
  const [autoLaunch, setAutoLaunch] = useState(false);
  const [startMinimized, setStartMinimized] = useState(false);
  const [trayEnabled, setTrayEnabled] = useState(false);
  const [globalShortcuts, setGlobalShortcuts] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ds = getDataService();
    Promise.all([
      ds.getAutoLaunch().catch(() => false),
      ds.getStartMinimized().catch(() => false),
      ds.getTrayEnabled().catch(() => false),
      ds.getGlobalShortcuts().catch(() => ({})),
    ]).then(([al, sm, te, gs]) => {
      setAutoLaunch(al);
      setStartMinimized(sm);
      setTrayEnabled(te);
      setGlobalShortcuts(gs);
      setLoading(false);
    });
  }, []);

  const handleAutoLaunchToggle = useCallback(() => {
    const next = !autoLaunch;
    setAutoLaunch(next);
    getDataService().setAutoLaunch(next);
  }, [autoLaunch]);

  const handleStartMinimizedToggle = useCallback(() => {
    const next = !startMinimized;
    setStartMinimized(next);
    getDataService().setStartMinimized(next);
  }, [startMinimized]);

  const handleTrayToggle = useCallback(() => {
    const next = !trayEnabled;
    setTrayEnabled(next);
    getDataService().setTrayEnabled(next);
  }, [trayEnabled]);

  if (loading) {
    return (
      <div data-section-id="system">
        <h3 className="text-lg font-semibold text-notion-text mb-4">
          {t("settings.system")}
        </h3>
        <p className="text-sm text-notion-text-secondary">Loading...</p>
      </div>
    );
  }

  return (
    <div data-section-id="system" className="space-y-6">
      <h3 className="text-lg font-semibold text-notion-text">
        {t("settings.system")}
      </h3>

      {/* Auto Launch */}
      <SettingRow
        icon={<Power size={18} className="text-notion-text-secondary" />}
        label={t("settings.autoLaunch")}
        description={t("settings.autoLaunchDesc")}
      >
        <ToggleSwitch enabled={autoLaunch} onToggle={handleAutoLaunchToggle} />
      </SettingRow>

      {/* Start Minimized */}
      <SettingRow
        icon={<Minimize2 size={18} className="text-notion-text-secondary" />}
        label={t("settings.startMinimized")}
        description={t("settings.startMinimizedDesc")}
      >
        <ToggleSwitch
          enabled={startMinimized}
          onToggle={handleStartMinimizedToggle}
        />
      </SettingRow>

      {/* System Tray */}
      <SettingRow
        icon={<AppWindow size={18} className="text-notion-text-secondary" />}
        label={t("settings.trayIcon")}
        description={t("settings.trayIconDesc")}
      >
        <ToggleSwitch enabled={trayEnabled} onToggle={handleTrayToggle} />
      </SettingRow>

      {/* Global Shortcuts */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Keyboard size={18} className="text-notion-text-secondary" />
          <div>
            <p className="text-sm text-notion-text">
              {t("settings.globalShortcuts")}
            </p>
            <p className="text-xs text-notion-text-secondary">
              {t("settings.globalShortcutsDesc")}
            </p>
          </div>
        </div>
        <div className="ml-8 space-y-2">
          <ShortcutRow
            label={t("settings.toggleTimerShortcut")}
            value={globalShortcuts.toggleTimer ?? "CmdOrCtrl+Shift+Space"}
            onChange={(val) => {
              const next = { ...globalShortcuts, toggleTimer: val };
              setGlobalShortcuts(next);
              getDataService().setGlobalShortcuts(next);
            }}
          />
          <ShortcutRow
            label={t("settings.quickAddTaskShortcut")}
            value={globalShortcuts.quickAddTask ?? "CmdOrCtrl+Shift+A"}
            onChange={(val) => {
              const next = { ...globalShortcuts, quickAddTask: val };
              setGlobalShortcuts(next);
              getDataService().setGlobalShortcuts(next);
            }}
          />
        </div>
      </div>
    </div>
  );
}

function SettingRow({
  icon,
  label,
  description,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-sm text-notion-text">{label}</p>
          <p className="text-xs text-notion-text-secondary">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function ToggleSwitch({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${
        enabled ? "bg-notion-accent" : "bg-notion-border"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${
          enabled ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}

function ShortcutRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
}) {
  const display = value
    .replace("CmdOrCtrl", navigator.platform.includes("Mac") ? "Cmd" : "Ctrl")
    .replace(/\+/g, " + ");

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-notion-text-secondary">{label}</span>
      <kbd className="px-2 py-1 text-xs bg-notion-bg-secondary border border-notion-border rounded text-notion-text font-mono">
        {display}
      </kbd>
    </div>
  );
}
