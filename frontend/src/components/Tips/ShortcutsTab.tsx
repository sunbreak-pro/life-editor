import { useTranslation } from "react-i18next";
import { Monitor, Apple } from "lucide-react";
import { DEFAULT_SHORTCUTS } from "../../constants/defaultShortcuts";
import { useShortcutConfig } from "../../hooks/useShortcutConfig";
import type { ShortcutCategory } from "../../types/shortcut";

const CATEGORY_ORDER: ShortcutCategory[] = [
  "global",
  "navigation",
  "view",
  "taskTree",
  "edit",
  "calendar",
];

const CATEGORY_LABEL_KEYS: Record<ShortcutCategory, string> = {
  global: "tips.shortcutsTab.global",
  navigation: "tips.shortcutsTab.navigation",
  view: "tips.shortcutsTab.view",
  taskTree: "tips.shortcutsTab.taskTree",
  edit: "tips.shortcutsTab.taskTree",
  calendar: "tips.shortcutsTab.calendar",
};

// Deduplicate entries with same descriptionKey within a category
function dedupeByDescription<T extends { descriptionKey: string }>(
  items: T[],
): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.descriptionKey)) return false;
    seen.add(item.descriptionKey);
    return true;
  });
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-block px-1.5 py-0.5 text-xs font-mono bg-notion-hover border border-notion-border rounded text-notion-text">
      {children}
    </kbd>
  );
}

interface ShortcutsTabProps {
  showMac: boolean;
  onToggleOS: (showMac: boolean) => void;
}

export function ShortcutsTab({ showMac, onToggleOS }: ShortcutsTabProps) {
  const { t } = useTranslation();
  const { getDisplayString } = useShortcutConfig();

  return (
    <div className="space-y-6">
      {/* OS Toggle */}
      <div className="flex items-center gap-1 bg-notion-bg-secondary rounded-lg p-1 w-fit border border-notion-border">
        <button
          onClick={() => onToggleOS(true)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            showMac
              ? "bg-notion-bg text-notion-text shadow-sm"
              : "text-notion-text-secondary hover:text-notion-text"
          }`}
        >
          <Apple size={14} />
          {t("tips.showMac")}
        </button>
        <button
          onClick={() => onToggleOS(false)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            !showMac
              ? "bg-notion-bg text-notion-text shadow-sm"
              : "text-notion-text-secondary hover:text-notion-text"
          }`}
        >
          <Monitor size={14} />
          {t("tips.showWin")}
        </button>
      </div>

      {CATEGORY_ORDER.map((category) => {
        const items = dedupeByDescription(
          DEFAULT_SHORTCUTS.filter((s) => s.category === category),
        );
        if (items.length === 0) return null;
        return (
          <div key={category}>
            <h3 className="text-lg font-semibold text-notion-text mb-3">
              {t(CATEGORY_LABEL_KEYS[category])}
            </h3>
            <table className="w-full text-sm">
              <tbody>
                {items.map((s) => (
                  <tr key={s.id} className="border-b border-notion-border/50">
                    <td className="py-2 pr-4 w-48">
                      <Kbd>{getDisplayString(s.id, showMac)}</Kbd>
                    </td>
                    <td className="py-2 text-notion-text-secondary">
                      {t(s.descriptionKey)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
