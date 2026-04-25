import { useEffect, useMemo } from "react";
import { Lightbulb, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SECTION_TIPS } from "../../config/sectionTips";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import type { SectionId } from "../../types/taskTree";
import type { TipsSectionId } from "../../types/tips";

const TIPS_SECTIONS: readonly TipsSectionId[] = [
  "schedule",
  "work",
  "materials",
  "connect",
  "terminal",
  "analytics",
];

function isTipsSection(section: SectionId): section is TipsSectionId {
  return (TIPS_SECTIONS as readonly SectionId[]).includes(section);
}

interface TipsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeSection: SectionId;
}

export function TipsPanel({ isOpen, onClose, activeSection }: TipsPanelProps) {
  const { t } = useTranslation();

  const tipsSection: TipsSectionId = isTipsSection(activeSection)
    ? activeSection
    : "schedule";

  const tabs = SECTION_TIPS[tipsSection];

  const tabKey = `${STORAGE_KEYS.TIPS_TAB_PREFIX}${tipsSection}`;
  const [activeTabId, setActiveTabId] = useLocalStorage<string>(
    tabKey,
    tabs[0]?.id ?? "",
    { serialize: (v) => v, deserialize: (v) => v },
  );

  // Ensure stored tab is valid for current section's tabs
  useEffect(() => {
    if (!tabs.find((t) => t.id === activeTabId)) {
      setActiveTabId(tabs[0]?.id ?? "");
    }
  }, [activeTabId, tabs, setActiveTabId]);

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? tabs[0],
    [tabs, activeTabId],
  );

  if (!isOpen) return null;

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-40 max-h-[55vh] flex flex-col border-t border-notion-border bg-notion-bg-secondary shadow-2xl"
      role="region"
      aria-label={t("tips.panel.title")}
    >
      <div className="flex items-center gap-2 px-3 h-9 shrink-0 border-b border-notion-border bg-notion-bg">
        <Lightbulb size={14} className="text-notion-accent shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wider text-notion-text-secondary shrink-0">
          {t(`tips.${tipsSection}.header`)}
        </span>
        <div className="flex-1 min-w-0 overflow-x-auto">
          <div className="flex items-center gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.id === activeTab?.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTabId(tab.id)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs whitespace-nowrap transition-colors ${
                    isActive
                      ? "bg-notion-hover text-notion-text font-medium"
                      : "text-notion-text-secondary hover:bg-notion-hover/60 hover:text-notion-text"
                  }`}
                >
                  <Icon size={12} />
                  <span>{t(tab.labelKey)}</span>
                </button>
              );
            })}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover transition-colors shrink-0"
          aria-label={t("tips.panel.close")}
          title={t("tips.panel.close")}
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
        {activeTab ? (
          <ul className="flex flex-col gap-2">
            {activeTab.tips.map((tip) => {
              const Icon = tip.icon;
              return (
                <li
                  key={tip.id}
                  className="flex items-start gap-2 rounded-md border border-notion-border bg-notion-bg px-2.5 py-2"
                >
                  <Icon
                    size={14}
                    className="mt-0.5 shrink-0 text-notion-accent"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-notion-text">
                      {t(tip.titleKey)}
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug text-notion-text-secondary">
                      {t(tip.descriptionKey)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-xs text-notion-text-secondary">
            {t("tips.panel.noTips")}
          </p>
        )}
      </div>
    </div>
  );
}
