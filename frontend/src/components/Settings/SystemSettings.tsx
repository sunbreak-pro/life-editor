import { useState, useCallback, useEffect } from "react";
import { Power, Minimize2, AppWindow } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getDataService } from "../../services/dataServiceFactory";
import { ToggleSwitch } from "../shared/ToggleSwitch";
import { BrowserSettings } from "./BrowserSettings";

export function SystemSettings() {
  const { t } = useTranslation();
  const [autoLaunch, setAutoLaunch] = useState(false);
  const [startMinimized, setStartMinimized] = useState(false);
  const [trayEnabled, setTrayEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ds = getDataService();
    Promise.all([
      ds.getAutoLaunch().catch(() => false),
      ds.getStartMinimized().catch(() => false),
      ds.getTrayEnabled().catch(() => false),
    ]).then(([al, sm, te]) => {
      setAutoLaunch(al);
      setStartMinimized(sm);
      setTrayEnabled(te);
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
        <ToggleSwitch checked={autoLaunch} onChange={handleAutoLaunchToggle} />
      </SettingRow>

      {/* Start Minimized */}
      <SettingRow
        icon={<Minimize2 size={18} className="text-notion-text-secondary" />}
        label={t("settings.startMinimized")}
        description={t("settings.startMinimizedDesc")}
      >
        <ToggleSwitch
          checked={startMinimized}
          onChange={handleStartMinimizedToggle}
        />
      </SettingRow>

      {/* System Tray */}
      <SettingRow
        icon={<AppWindow size={18} className="text-notion-text-secondary" />}
        label={t("settings.trayIcon")}
        description={t("settings.trayIconDesc")}
      >
        <ToggleSwitch checked={trayEnabled} onChange={handleTrayToggle} />
      </SettingRow>

      {/* Default browser for sidebar links */}
      <BrowserSettings />
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
