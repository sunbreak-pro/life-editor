import type { ReactNode } from "react";
import {
  PanelLeftClose,
  PanelLeftOpen,
  Command as CommandIcon,
  LogOut,
} from "lucide-react";
import { cn } from "./cn";
import { NavItem } from "./NavItem";
import { IconButton } from "./IconButton";

export interface SidebarNavSection {
  id: string;
  /** Already-translated section label (§6.4). */
  label: string;
  /** Already-sized icon node. */
  icon: ReactNode;
}

export interface SidebarNavLabels {
  /** Brand / app name shown in the header (untranslated brand by default). */
  appName: string;
  collapse: string;
  expand: string;
  commandPalette: string;
  signOut: string;
}

export interface SidebarNavProps {
  sections: SidebarNavSection[];
  activeSection: string;
  onNavigate: (id: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onTogglePalette: () => void;
  userEmail: string;
  onSignOut: () => void;
  labels: SidebarNavLabels;
}

/*
 * Wide-layout sidebar (W5 app shell). Header (brand + collapse toggle),
 * a scrollable section list, and a footer with Cmd+K / user email /
 * sign-out. Collapsible to an icon-only rail. Pure presentation: section
 * state + labels are injected (§3.1 / §6.4), ink-* tokens only with an
 * opaque container background (§5).
 */
export function SidebarNav({
  sections,
  activeSection,
  onNavigate,
  collapsed,
  onToggleCollapsed,
  onTogglePalette,
  userEmail,
  onSignOut,
  labels,
}: SidebarNavProps) {
  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-ink-border",
        "bg-ink-bg-subsidebar transition-[width] duration-200",
        collapsed ? "w-16" : "w-60",
      )}
      aria-label={labels.appName}
    >
      {/* Header: brand + collapse toggle */}
      <div
        className={cn(
          "flex h-12 shrink-0 items-center border-b border-ink-border px-2",
          collapsed ? "justify-center" : "justify-between",
        )}
      >
        {!collapsed && (
          <span className="truncate px-1.5 text-sm font-semibold text-ink-text">
            {labels.appName}
          </span>
        )}
        <IconButton
          icon={collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          label={collapsed ? labels.expand : labels.collapse}
          onClick={onToggleCollapsed}
        />
      </div>

      {/* Section list */}
      <nav
        aria-label={labels.appName}
        className="flex-1 space-y-0.5 overflow-y-auto p-2"
      >
        {sections.map((s) => (
          <NavItem
            key={s.id}
            icon={s.icon}
            label={s.label}
            active={activeSection === s.id}
            collapsed={collapsed}
            onClick={() => onNavigate(s.id)}
          />
        ))}
      </nav>

      {/* Footer: command palette + user + sign out */}
      <div className="shrink-0 space-y-1 border-t border-ink-border p-2">
        <NavItem
          icon={<CommandIcon size={18} />}
          label={labels.commandPalette}
          collapsed={collapsed}
          onClick={onTogglePalette}
        />
        {collapsed ? (
          <IconButton
            icon={<LogOut size={18} />}
            label={labels.signOut}
            onClick={onSignOut}
            className="mx-auto"
          />
        ) : (
          <div className="flex items-center gap-1.5 px-1">
            <span
              className="min-w-0 flex-1 truncate text-xs text-ink-text-secondary"
              title={userEmail}
            >
              {userEmail}
            </span>
            <IconButton
              icon={<LogOut size={16} />}
              label={labels.signOut}
              size="sm"
              onClick={onSignOut}
            />
          </div>
        )}
      </div>
    </aside>
  );
}
