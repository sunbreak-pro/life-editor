import { useRef, useState } from "react";
import {
  CheckSquare,
  Calendar,
  Lightbulb,
  Play,
  BarChart3,
  Settings,
  BookOpen,
  Link2,
} from "lucide-react";
import type { SectionId } from "../../types/taskTree";
import { useTranslation } from "react-i18next";
import { useSidebarLinksContext } from "../../hooks/useSidebarLinksContext";
import { SidebarLinksListDialog } from "./SidebarLinksListDialog";

interface CollapsedSidebarProps {
  activeSection: SectionId;
  onSectionChange: (section: SectionId) => void;
  onToggleTips: () => void;
  tipsOpen: boolean;
}

const mainItems: {
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

export function CollapsedSidebar({
  activeSection,
  onSectionChange,
  onToggleTips,
  tipsOpen,
}: CollapsedSidebarProps) {
  const { t } = useTranslation();
  const { links } = useSidebarLinksContext();
  const [linksDialogOpen, setLinksDialogOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const linkButtonRef = useRef<HTMLButtonElement>(null);

  const handleOpenLinksDialog = () => {
    if (linkButtonRef.current) {
      setAnchorRect(linkButtonRef.current.getBoundingClientRect());
    }
    setLinksDialogOpen(true);
  };

  return (
    <div className="h-full bg-notion-bg-subsidebar border-r border-notion-border flex flex-col items-center py-2 shrink-0 w-12">
      <nav className="flex-1 flex flex-col items-center gap-0.5">
        {mainItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              title={t(item.labelKey)}
              onClick={() => onSectionChange(item.id)}
              className={`p-2 rounded-md transition-colors ${
                isActive
                  ? "bg-notion-hover text-notion-text"
                  : "text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover"
              }`}
            >
              <Icon size={18} />
            </button>
          );
        })}
        <div className="w-6 mt-2 mb-1 border-t border-notion-border" />
        <button
          ref={linkButtonRef}
          title={t("sidebarLinks.sectionTitle", "Links")}
          aria-label={t("sidebarLinks.sectionTitle", "Links")}
          onClick={handleOpenLinksDialog}
          className="relative p-2 rounded-md transition-colors text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover"
        >
          <Link2 size={18} />
          {links.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-1 rounded-full bg-notion-accent text-white text-[9px] font-medium leading-[14px] text-center">
              {links.length > 99 ? "99+" : links.length}
            </span>
          )}
        </button>
      </nav>
      <div className="flex flex-col items-center gap-0.5 border-t border-notion-border pt-2">
        <button
          title={t("tips.panel.title")}
          onClick={onToggleTips}
          aria-pressed={tipsOpen}
          className={`p-2 rounded-md transition-colors ${
            tipsOpen
              ? "bg-notion-hover text-notion-text"
              : "text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover"
          }`}
        >
          <Lightbulb size={18} />
        </button>
        <button
          title={t("sidebar.settings")}
          onClick={() => onSectionChange("settings")}
          className={`p-2 rounded-md transition-colors ${
            activeSection === "settings"
              ? "text-notion-text"
              : "text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover"
          }`}
        >
          <Settings size={18} />
        </button>
      </div>

      {linksDialogOpen && (
        <SidebarLinksListDialog
          anchorRect={anchorRect}
          onClose={() => setLinksDialogOpen(false)}
        />
      )}
    </div>
  );
}
