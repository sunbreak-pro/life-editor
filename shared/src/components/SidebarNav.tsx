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
  /** Keycap hint shown at the trailing edge of the ⌘K footer row (e.g. "⌘K"). */
  shortcutHint?: string;
}

export interface SidebarNavProps {
  sections: SidebarNavSection[];
  /**
   * Utility group (Settings / Trash). Rendered below the mainline sections,
   * pushed to the bottom by a spacer + divider and shown muted so it reads
   * as secondary to the mainline nav.
   */
  utilitySections?: SidebarNavSection[];
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
 * Wide-layout sidebar (W5 app shell). Header (brand mark + name + collapse
 * toggle), a scrollable mainline section list, a bottom-pinned utility group
 * (muted, separated by a divider), and a footer with Cmd+K / user email /
 * sign-out. Collapsible to an icon-only rail. Pure presentation: section
 * state + labels are injected (§3.1 / §6.4), lumen-* tokens only with an
 * opaque container background (§5).
 */
export function SidebarNav({
  sections,
  utilitySections,
  activeSection,
  onNavigate,
  collapsed,
  onToggleCollapsed,
  onTogglePalette,
  userEmail,
  onSignOut,
  labels,
}: SidebarNavProps) {
  const hasUtility = utilitySections != null && utilitySections.length > 0;
  const brandInitial = labels.appName.charAt(0);

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-lumen-border",
        "bg-lumen-bg-subsidebar transition-[width] duration-200",
        collapsed ? "w-16" : "w-60",
      )}
      aria-label={labels.appName}
    >
      {/* Header: brand mark (+ name) + collapse toggle */}
      <div
        className={cn(
          "flex h-12 shrink-0 items-center justify-between border-b border-lumen-border",
          collapsed ? "px-1.5" : "px-2",
        )}
      >
        <div className="flex min-w-0 items-center gap-2 pl-1">
          <span
            aria-hidden="true"
            className="grid h-6 w-6 shrink-0 place-items-center rounded-lumen-md bg-lumen-accent text-[12px] font-bold text-lumen-on-accent"
          >
            {brandInitial}
          </span>
          {!collapsed && (
            <span className="truncate text-sm font-semibold text-lumen-text">
              {labels.appName}
            </span>
          )}
        </div>
        <IconButton
          icon={
            collapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )
          }
          label={collapsed ? labels.expand : labels.collapse}
          onClick={onToggleCollapsed}
        />
      </div>

      {/* Section list: mainline, then a bottom-pinned muted utility group */}
      <nav
        aria-label={labels.appName}
        className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2"
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
        {hasUtility && (
          <>
            <div className="mt-auto" />
            <div
              role="separator"
              className={cn(
                "my-2 h-px shrink-0 bg-lumen-border",
                collapsed ? "mx-auto w-10" : "mx-0.5",
              )}
            />
            {utilitySections.map((s) => (
              <NavItem
                key={s.id}
                icon={s.icon}
                label={s.label}
                active={activeSection === s.id}
                collapsed={collapsed}
                tone="muted"
                onClick={() => onNavigate(s.id)}
              />
            ))}
          </>
        )}
      </nav>

      {/* Footer: command palette (+ ⌘K keycap) + user + sign out */}
      <div className="shrink-0 space-y-1 border-t border-lumen-border p-2">
        <button
          type="button"
          onClick={onTogglePalette}
          aria-label={labels.commandPalette}
          title={collapsed ? labels.commandPalette : undefined}
          className={cn(
            "flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-sm",
            "text-lumen-text-secondary transition-colors hover:bg-lumen-hover",
            "hover:text-lumen-text focus-visible:outline-none focus-visible:ring-2",
            "focus-visible:ring-lumen-accent",
            collapsed && "justify-center px-0",
          )}
        >
          <span aria-hidden="true" className="shrink-0">
            <CommandIcon size={18} />
          </span>
          {!collapsed && (
            <>
              <span className="flex-1 truncate text-left">
                {labels.commandPalette}
              </span>
              {labels.shortcutHint && (
                <kbd
                  aria-hidden="true"
                  className="rounded border border-lumen-border bg-lumen-bg px-1.5 py-px text-[11px] text-lumen-text-tertiary"
                >
                  {labels.shortcutHint}
                </kbd>
              )}
            </>
          )}
        </button>
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
              className="min-w-0 flex-1 truncate text-xs text-lumen-text-secondary"
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
