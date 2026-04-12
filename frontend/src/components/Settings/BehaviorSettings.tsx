import { useState, useCallback, useEffect } from "react";
import { Play, FolderOpen, Archive, EyeOff, ListChecks } from "lucide-react";
import { useTranslation } from "react-i18next";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import { ToggleSwitch } from "../shared/ToggleSwitch";
import { useTaskTreeContext } from "../../hooks/useTaskTreeContext";
import { getDataService } from "../../services/dataServiceFactory";
import type { SectionId } from "../../types/taskTree";

const SECTION_OPTIONS: { value: SectionId | ""; labelKey: string }[] = [
  { value: "schedule", labelKey: "nav.schedule" },
  { value: "materials", labelKey: "nav.materials" },
  { value: "connect", labelKey: "nav.connect" },
  { value: "work", labelKey: "nav.work" },
  { value: "analytics", labelKey: "nav.analytics" },
];

const ARCHIVE_DAY_OPTIONS = [0, 7, 14, 30, 60, 90];

export function BehaviorSettings() {
  const { t } = useTranslation();
  const { nodes } = useTaskTreeContext();

  // Startup screen
  const [startupScreen, setStartupScreen] = useState(
    () => localStorage.getItem(STORAGE_KEYS.STARTUP_SCREEN) ?? "schedule",
  );

  // Default task folder
  const [defaultFolder, setDefaultFolder] = useState(
    () => localStorage.getItem(STORAGE_KEYS.DEFAULT_TASK_FOLDER) ?? "",
  );

  // Hide completed tasks
  const [hideCompleted, setHideCompleted] = useState(
    () => localStorage.getItem(STORAGE_KEYS.HIDE_COMPLETED_TASKS) === "true",
  );

  // Auto-complete parent
  const [autoCompleteParent, setAutoCompleteParent] = useState(
    () => localStorage.getItem(STORAGE_KEYS.AUTO_COMPLETE_PARENT) === "true",
  );

  // Auto-archive days (stored in app_settings via IPC)
  const [archiveDays, setArchiveDays] = useState(0);
  useEffect(() => {
    getDataService()
      .getAppSetting("auto_archive_days")
      .then((val) => {
        if (val) setArchiveDays(Number(val));
      })
      .catch(() => {});
  }, []);

  const folders = nodes.filter(
    (n) => n.type === "folder" && !n.isDeleted && n.folderType !== "complete",
  );

  const handleStartupChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      setStartupScreen(val);
      localStorage.setItem(STORAGE_KEYS.STARTUP_SCREEN, val);
    },
    [],
  );

  const handleFolderChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      setDefaultFolder(val);
      if (val) {
        localStorage.setItem(STORAGE_KEYS.DEFAULT_TASK_FOLDER, val);
      } else {
        localStorage.removeItem(STORAGE_KEYS.DEFAULT_TASK_FOLDER);
      }
    },
    [],
  );

  const handleHideCompletedToggle = useCallback(() => {
    const next = !hideCompleted;
    setHideCompleted(next);
    localStorage.setItem(STORAGE_KEYS.HIDE_COMPLETED_TASKS, String(next));
  }, [hideCompleted]);

  const handleAutoCompleteToggle = useCallback(() => {
    const next = !autoCompleteParent;
    setAutoCompleteParent(next);
    localStorage.setItem(STORAGE_KEYS.AUTO_COMPLETE_PARENT, String(next));
  }, [autoCompleteParent]);

  const handleArchiveChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = Number(e.target.value);
      setArchiveDays(val);
      if (val > 0) {
        getDataService().setAppSetting("auto_archive_days", String(val));
      } else {
        getDataService().removeAppSetting("auto_archive_days");
      }
    },
    [],
  );

  return (
    <div data-section-id="behaviors" className="space-y-6">
      <h3 className="text-lg font-semibold text-notion-text">
        {t("settings.behaviors")}
      </h3>

      {/* Startup Screen */}
      <SettingRow
        icon={<Play size={18} className="text-notion-text-secondary" />}
        label={t("settings.startupScreen")}
        description={t("settings.startupScreenDesc")}
      >
        <select
          value={startupScreen}
          onChange={handleStartupChange}
          className="text-sm bg-notion-bg-secondary border border-notion-border rounded-md px-3 py-1.5 text-notion-text"
        >
          {SECTION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t(opt.labelKey)}
            </option>
          ))}
        </select>
      </SettingRow>

      {/* Default Task Folder */}
      <SettingRow
        icon={<FolderOpen size={18} className="text-notion-text-secondary" />}
        label={t("settings.defaultTaskFolder")}
        description={t("settings.defaultTaskFolderDesc")}
      >
        <select
          value={defaultFolder}
          onChange={handleFolderChange}
          className="text-sm bg-notion-bg-secondary border border-notion-border rounded-md px-3 py-1.5 text-notion-text max-w-[200px]"
        >
          <option value="">{t("settings.noDefaultFolder")}</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.title}
            </option>
          ))}
        </select>
      </SettingRow>

      {/* Auto-archive */}
      <SettingRow
        icon={<Archive size={18} className="text-notion-text-secondary" />}
        label={t("settings.autoArchive")}
        description={t("settings.autoArchiveDesc")}
      >
        <select
          value={archiveDays}
          onChange={handleArchiveChange}
          className="text-sm bg-notion-bg-secondary border border-notion-border rounded-md px-3 py-1.5 text-notion-text"
        >
          <option value={0}>{t("settings.autoArchiveDisabled")}</option>
          {ARCHIVE_DAY_OPTIONS.filter((d) => d > 0).map((d) => (
            <option key={d} value={d}>
              {t("settings.autoArchiveDays", { days: d })}
            </option>
          ))}
        </select>
      </SettingRow>

      {/* Hide Completed Tasks */}
      <SettingRow
        icon={<EyeOff size={18} className="text-notion-text-secondary" />}
        label={t("settings.hideCompletedTasks")}
        description={t("settings.hideCompletedTasksDesc")}
      >
        <ToggleSwitch
          checked={hideCompleted}
          onChange={handleHideCompletedToggle}
        />
      </SettingRow>

      {/* Auto-complete Parent */}
      <SettingRow
        icon={<ListChecks size={18} className="text-notion-text-secondary" />}
        label={t("settings.autoCompleteParent")}
        description={t("settings.autoCompleteParentDesc")}
      >
        <ToggleSwitch
          checked={autoCompleteParent}
          onChange={handleAutoCompleteToggle}
        />
      </SettingRow>
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
