import { useState, useEffect, useCallback } from "react";
import { Download, Trash2, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

interface SkillInfo {
  name: string;
  description: string;
  sourcePath: string;
  scope: "global" | "project";
}

export function SkillsManager() {
  const { t } = useTranslation();
  const [available, setAvailable] = useState<SkillInfo[]>([]);
  const [installed, setInstalled] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [avail, inst] = await Promise.all([
        window.electronAPI?.invoke<SkillInfo[]>("claude:listAvailableSkills") ??
          [],
        window.electronAPI?.invoke<string[]>("claude:listInstalledSkills") ??
          [],
      ]);
      setAvailable(avail);
      setInstalled(inst);
    } catch (e) {
      console.warn("Failed to load skills:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleInstall = async (skill: SkillInfo) => {
    try {
      await window.electronAPI?.invoke(
        "claude:installSkill",
        skill.sourcePath,
        skill.name,
      );
      setInstalled((prev) => [...prev, skill.name]);
    } catch (e) {
      console.warn("Install failed:", e);
    }
  };

  const handleUninstall = async (name: string) => {
    try {
      await window.electronAPI?.invoke("claude:uninstallSkill", name);
      setInstalled((prev) => prev.filter((n) => n !== name));
    } catch (e) {
      console.warn("Uninstall failed:", e);
    }
  };

  if (loading) {
    return <div className="text-sm text-notion-text-secondary">Loading...</div>;
  }

  return (
    <div data-section-id="claude-skills">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-notion-text-secondary">
          {t("settings.claude.skillsDescription")}
        </p>
        <button
          onClick={refresh}
          className="p-1.5 text-notion-text-secondary hover:text-notion-text rounded-md hover:bg-notion-hover transition-colors"
          title="Refresh"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {available.length === 0 ? (
        <p className="text-sm text-notion-text-secondary italic">
          {t("settings.claude.noSkillsFound")}
        </p>
      ) : (
        <div className="space-y-2">
          {available.map((skill) => {
            const isInstalled = installed.includes(skill.name);
            return (
              <div
                key={`${skill.scope}-${skill.name}`}
                className="flex items-center gap-3 p-3 border border-notion-border rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-notion-text">
                      {skill.name}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        skill.scope === "global"
                          ? "bg-blue-500/10 text-blue-500"
                          : "bg-green-500/10 text-green-500"
                      }`}
                    >
                      {skill.scope === "global"
                        ? t("settings.claude.scopeGlobal")
                        : t("settings.claude.scopeProject")}
                    </span>
                  </div>
                  {skill.description && (
                    <p className="text-xs text-notion-text-secondary mt-0.5 truncate">
                      {skill.description}
                    </p>
                  )}
                </div>
                {isInstalled ? (
                  <button
                    onClick={() => handleUninstall(skill.name)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-500 border border-red-500/30 rounded-md hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={12} />
                    {t("settings.claude.uninstall")}
                  </button>
                ) : (
                  <button
                    onClick={() => handleInstall(skill)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-notion-accent border border-notion-accent/30 rounded-md hover:bg-notion-accent/10 transition-colors"
                  >
                    <Download size={12} />
                    {t("settings.claude.install")}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
