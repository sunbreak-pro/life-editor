import { useState } from "react";
import {
  CheckSquare,
  Calendar,
  Lightbulb,
  Play,
  BarChart3,
  Settings,
  Pencil,
  BookOpen,
  Plus,
  Link2,
} from "lucide-react";
import type { SectionId } from "../../types/taskTree";
import { useTimerContext } from "../../hooks/useTimerContext";
import { useSidebarLinksContext } from "../../hooks/useSidebarLinksContext";
import { useTranslation } from "react-i18next";
import { SidebarLinkItem } from "./SidebarLinkItem";
import { SidebarLinkAddDialog } from "./SidebarLinkAddDialog";
import type { SidebarLink } from "../../types/sidebarLink";

interface SidebarProps {
  width: number;
  activeSection: SectionId;
  onSectionChange: (section: SectionId) => void;
  onToggleTips: () => void;
  tipsOpen: boolean;
}

const mainMenuItems: {
  id: SectionId;
  labelKey: string;
  icon: typeof CheckSquare;
}[] = [
  { id: "schedule", labelKey: "sidebar.schedule", icon: Calendar },
  { id: "materials", labelKey: "sidebar.materials", icon: BookOpen },
  { id: "connect", labelKey: "sidebar.connect", icon: Lightbulb },
  { id: "work", labelKey: "sidebar.work", icon: Play },
  { id: "analytics", labelKey: "sidebar.analytics", icon: BarChart3 },
];

const ICON_SIZE = 18;
const TEXT_PX = 16; // icon - 2px

export function LeftSidebar({
  width,
  activeSection,
  onSectionChange,
  onToggleTips,
  tipsOpen,
}: SidebarProps) {
  const timer = useTimerContext();
  const { t } = useTranslation();
  const showTimer = timer.activeTask !== null || timer.isRunning;

  const { links, createLink, updateLink, deleteLink, openLink } =
    useSidebarLinksContext();
  const [dialogState, setDialogState] = useState<
    { mode: "closed" } | { mode: "add" } | { mode: "edit"; link: SidebarLink }
  >({ mode: "closed" });

  return (
    <aside
      className="h-full bg-notion-bg-subsidebar border-r border-notion-border flex flex-col transition-colors"
      style={{ width }}
    >
      <nav className="flex-1 p-2 pt-1.5 space-y-0.5 overflow-y-auto">
        {mainMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <div key={item.id}>
              <button
                onClick={() => onSectionChange(item.id)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition-all duration-200 ${
                  isActive
                    ? "bg-notion-hover text-notion-text font-medium"
                    : "text-notion-text-secondary hover:bg-notion-hover/80 hover:text-notion-text"
                }`}
                style={{ fontSize: TEXT_PX, lineHeight: 1.25 }}
              >
                <Icon
                  size={ICON_SIZE}
                  className={`transition-colors ${isActive ? "text-notion-accent" : ""}`}
                />
                <span>{t(item.labelKey)}</span>
              </button>

              {item.id === "work" && showTimer && (
                <div className="ml-2.5 mr-1.5 mb-1.5 mt-0.5 px-2.5 py-1.5 rounded-md bg-notion-hover/50">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-notion-text-secondary truncate"
                        style={{ fontSize: TEXT_PX - 3, lineHeight: 1.2 }}
                      >
                        {timer.activeTask?.title ?? t("sidebar.freeSession")}
                      </p>
                      <p
                        className="font-mono font-medium tabular-nums text-notion-accent mt-0.5"
                        style={{ fontSize: TEXT_PX - 1, lineHeight: 1.2 }}
                      >
                        {timer.formatTime(timer.remainingSeconds)}
                      </p>
                    </div>
                    <button
                      onClick={() => onSectionChange("work")}
                      className="p-1 text-notion-text-secondary hover:text-notion-text rounded transition-colors shrink-0 cursor-pointer"
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Sidebar Links section */}
        <div className="group/section pt-3 mt-2 border-t border-notion-border">
          <div className="flex items-center justify-between px-2.5 pb-1.5">
            <span className="flex items-center gap-1.5 uppercase tracking-wider text-notion-text-secondary font-semibold text-[11px]">
              <Link2 size={13} />
              {t("sidebarLinks.sectionTitle", "Links")}
            </span>
            <button
              type="button"
              onClick={() => setDialogState({ mode: "add" })}
              aria-label={t("sidebarLinks.add", "Add link")}
              className="p-0.5 rounded text-notion-text-secondary opacity-0 group-hover/section:opacity-100 hover:bg-notion-hover hover:text-notion-text transition-opacity"
            >
              <Plus size={12} />
            </button>
          </div>
          {links.map((link) => (
            <SidebarLinkItem
              key={link.id}
              link={link}
              iconSize={ICON_SIZE}
              textPx={TEXT_PX}
              onClick={(l) => {
                openLink(l).catch(() => {
                  /* errors logged in useSidebarLinks */
                });
              }}
              onEdit={(l) => setDialogState({ mode: "edit", link: l })}
              onDelete={(l) => {
                deleteLink(l.id);
              }}
            />
          ))}
          {links.length === 0 && (
            <div
              className="px-2.5 py-1 text-notion-text-secondary/60 italic"
              style={{ fontSize: TEXT_PX - 3 }}
            >
              {t("sidebarLinks.empty", "No links yet")}
            </div>
          )}
        </div>
      </nav>
      <div className="p-2 pt-2 space-y-0.5 border-t border-notion-border">
        <button
          onClick={onToggleTips}
          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition-all duration-200 ${
            tipsOpen
              ? "bg-notion-hover text-notion-text font-medium"
              : "text-notion-text-secondary hover:bg-notion-hover/80 hover:text-notion-text"
          }`}
          style={{ fontSize: TEXT_PX, lineHeight: 1.25 }}
          title={t("tips.panel.title")}
          aria-pressed={tipsOpen}
        >
          <Lightbulb
            size={ICON_SIZE}
            className={tipsOpen ? "text-notion-accent" : ""}
          />
          <span>{t("sidebar.tipsButton")}</span>
        </button>
        <button
          onClick={() => onSectionChange("settings")}
          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition-all duration-200 ${
            activeSection === "settings"
              ? "bg-notion-hover text-notion-text font-medium"
              : "text-notion-text-secondary hover:bg-notion-hover/80 hover:text-notion-text"
          }`}
          style={{ fontSize: TEXT_PX, lineHeight: 1.25 }}
        >
          <Settings size={ICON_SIZE} />
          <span>{t("sidebar.settings")}</span>
        </button>
      </div>

      {dialogState.mode !== "closed" && (
        <SidebarLinkAddDialog
          initial={dialogState.mode === "edit" ? dialogState.link : null}
          onClose={() => setDialogState({ mode: "closed" })}
          onSubmit={async (input) => {
            if (dialogState.mode === "edit") {
              await updateLink(dialogState.link.id, input);
            } else {
              await createLink(input);
            }
          }}
        />
      )}
    </aside>
  );
}
