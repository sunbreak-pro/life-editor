import { useTranslation } from "react-i18next";
import { Monitor, Apple } from "lucide-react";

interface ShortcutEntry {
  keys: string;
  descriptionKey: string;
}

interface ShortcutGroup {
  categoryKey: string;
  shortcuts: ShortcutEntry[];
}

function getShortcutGroups(mod: string, shift: string): ShortcutGroup[] {
  return [
    {
      categoryKey: "tips.shortcutsTab.global",
      shortcuts: [
        {
          keys: `${mod} + K`,
          descriptionKey: "tips.shortcutsTab.openCommandPalette",
        },
        {
          keys: `${mod} + ,`,
          descriptionKey: "tips.shortcutsTab.openSettings",
        },
        {
          keys: `${mod} + ${shift} + T`,
          descriptionKey: "tips.shortcutsTab.toggleTimerModal",
        },
        { keys: "Space", descriptionKey: "tips.shortcutsTab.playPauseTimer" },
        { keys: "n", descriptionKey: "tips.shortcutsTab.createNewTask" },
        { keys: "r", descriptionKey: "tips.shortcutsTab.resetTimer" },
        { keys: "Escape", descriptionKey: "tips.shortcutsTab.closeModal" },
      ],
    },
    {
      categoryKey: "tips.shortcutsTab.navigation",
      shortcuts: [
        { keys: `${mod} + 1`, descriptionKey: "tips.shortcutsTab.goToTasks" },
        { keys: `${mod} + 2`, descriptionKey: "tips.shortcutsTab.goToWork" },
        {
          keys: `${mod} + 3`,
          descriptionKey: "tips.shortcutsTab.goToAnalytics",
        },
      ],
    },
    {
      categoryKey: "tips.shortcutsTab.view",
      shortcuts: [
        {
          keys: `${mod} + .`,
          descriptionKey: "tips.shortcutsTab.toggleLeftSidebar",
        },
      ],
    },
    {
      categoryKey: "tips.shortcutsTab.taskTree",
      shortcuts: [
        { keys: "↑ / ↓", descriptionKey: "tips.shortcutsTab.moveBetweenTasks" },
        { keys: "→", descriptionKey: "tips.shortcutsTab.expandFolder" },
        { keys: "←", descriptionKey: "tips.shortcutsTab.collapseFolder" },
        {
          keys: `${mod} + Enter`,
          descriptionKey: "tips.shortcutsTab.toggleTaskCompletion",
        },
        { keys: "Tab", descriptionKey: "tips.shortcutsTab.indent" },
        { keys: `${shift} + Tab`, descriptionKey: "tips.shortcutsTab.outdent" },
        {
          keys: `${mod} + Z`,
          descriptionKey: "tips.shortcutsTab.undoTaskTree",
        },
        {
          keys: `${mod} + ${shift} + Z`,
          descriptionKey: "tips.shortcutsTab.redoTaskTree",
        },
        { keys: "Drag & Drop", descriptionKey: "tips.shortcutsTab.dragDrop" },
      ],
    },
    {
      categoryKey: "tips.shortcutsTab.timer",
      shortcuts: [
        { keys: "Space", descriptionKey: "tips.shortcutsTab.togglePlayPause" },
        { keys: "r", descriptionKey: "tips.shortcutsTab.resetTimer" },
        { keys: "Escape", descriptionKey: "tips.shortcutsTab.closeModal" },
      ],
    },
    {
      categoryKey: "tips.shortcutsTab.calendar",
      shortcuts: [
        { keys: "j", descriptionKey: "tips.shortcutsTab.nextMonthWeek" },
        { keys: "k", descriptionKey: "tips.shortcutsTab.prevMonthWeek" },
        { keys: "t", descriptionKey: "tips.shortcutsTab.jumpToToday" },
        { keys: "m", descriptionKey: "tips.shortcutsTab.toggleMonthWeek" },
      ],
    },
  ];
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
  const mod = showMac ? "⌘" : "Ctrl";
  const shift = showMac ? "⇧" : "Shift";
  const groups = getShortcutGroups(mod, shift);

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

      {groups.map((group) => (
        <div key={group.categoryKey}>
          <h3 className="text-lg font-semibold text-notion-text mb-3">
            {t(group.categoryKey)}
          </h3>
          <table className="w-full text-sm">
            <tbody>
              {group.shortcuts.map((s, i) => (
                <tr key={i} className="border-b border-notion-border/50">
                  <td className="py-2 pr-4 w-48">
                    <Kbd>{s.keys}</Kbd>
                  </td>
                  <td className="py-2 text-notion-text-secondary">
                    {t(s.descriptionKey)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
