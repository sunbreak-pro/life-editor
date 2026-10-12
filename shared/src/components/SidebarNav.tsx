import type { ReactNode } from "react";
import {
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Terminal as TerminalIcon,
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
  /**
   * Optional live status line under the label (#550 — the Work row's running
   * timer, injected as a <NavTimerStatus /> by the host). Wide sidebar only;
   * the narrow BottomTabBar ignores it.
   */
  sublabel?: ReactNode;
  /**
   * Optional icon-corner mark for the surfaces with no room for `sublabel`
   * (#1858 — the Work row's <NavTimerDot />): the collapsed rail here and the
   * narrow BottomTabBar. Hidden on the expanded row.
   */
  badge?: ReactNode;
}

export interface SidebarNavLabels {
  /** Brand / app name shown in the header (untranslated brand by default). */
  appName: string;
  collapse: string;
  expand: string;
  signOut: string;
  /**
   * "Launch Claude Code" footer row (#1211). Two halves: the row needs this
   * AND `onLaunchClaude` to render.
   */
  launchClaude?: string;
  /**
   * "Edit profile" (#1624). Same two-halves contract: the account row becomes
   * a button only with this AND `onOpenProfile`.
   */
  profile?: string;
}

export interface SidebarNavProps {
  sections: SidebarNavSection[];
  /**
   * Utility group (Settings). Rendered below the mainline sections, pushed to
   * the bottom by a spacer + divider so it reads as secondary to the mainline
   * nav. Its rows use the same text token as the footer rows below (#1623).
   */
  utilitySections?: SidebarNavSection[];
  activeSection: string;
  onNavigate: (id: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /**
   * Launches Claude Code in the saved project folder (#1211). Rendered as the
   * FIRST footer row, so the action sits at the bottom of the column with the
   * other app-global entries rather than posing as a section.
   *
   * Desktop-only by construction: the host passes this only where the Electron
   * bridge exists, which is what keeps the browser and the Capacitor shells
   * from showing a button that has no CLI to start.
   */
  onLaunchClaude?: () => void;
  userEmail: string;
  /**
   * Text of the account row (#1624): the display name, or the address when
   * none is set — the host resolves the fallback. Omit to show `userEmail`.
   */
  userName?: string;
  /**
   * Opens the profile editor (#1624). With `labels.profile` it turns the
   * account row into a button; the address moves to its tooltip.
   */
  onOpenProfile?: () => void;
  onSignOut: () => void;
  labels: SidebarNavLabels;
}

/*
 * Wide-layout sidebar (W5 app shell). Header (brand mark + name + collapse
 * toggle), a scrollable mainline section list, a bottom-pinned utility group
 * (separated by a divider), and a footer with the account row / sign-out.
 * The command palette has no row here (#2216): the header's search field
 * and Cmd/Ctrl+K open it. Collapsible to an icon-only rail. Pure presentation: section
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
  onLaunchClaude,
  userEmail,
  userName,
  onOpenProfile,
  onSignOut,
  labels,
}: SidebarNavProps) {
  const hasUtility = utilitySections != null && utilitySections.length > 0;
  const brandInitial = labels.appName.charAt(0);
  // Both halves must be present: a row with no handler does nothing, a row
  // with no label would render untranslated (§6.4 — copy is injected).
  const launchClaudeLabel = onLaunchClaude ? labels.launchClaude : undefined;
  const profileLabel = onOpenProfile ? labels.profile : undefined;
  const accountText = userName || userEmail;

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-lumen-border",
        "bg-lumen-bg-subsidebar transition-[width] duration-200",
        collapsed ? "w-16" : "w-60",
      )}
      aria-label={labels.appName}
    >
      {/*
       * Header: brand mark (+ name) + collapse toggle.
       *
       * The height is the shared --spacing-lumen-header pair, NOT a literal
       * (#1399). This row and <SectionHeader> are siblings across the top of
       * the wide layout — same starting y, both ending in a border-b — so
       * their heights have to be one number or the seam shows. At this row's
       * own `h-12` (3rem) against the header's 3.5 / 3.75rem it did: the brand
       * mark sat above the section title and the two dividers stepped 13.5px
       * apart at the default font size. Keep it equal to SectionHeader's
       * minimum; do not re-inline a value.
       */}
      <div
        className={cn(
          "flex shrink-0 items-center justify-between border-b border-lumen-border",
          "h-lumen-header md:h-lumen-header-wide",
          collapsed ? "px-1.5" : "px-2",
        )}
      >
        <div className="flex min-w-0 items-center gap-2 pl-1">
          <span
            aria-hidden="true"
            className="grid h-6 w-6 shrink-0 place-items-center rounded-lumen-md bg-lumen-accent text-xs font-bold text-lumen-on-accent"
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

      {/* Section list: mainline, then a bottom-pinned utility group */}
      <nav
        aria-label={labels.appName}
        className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2"
      >
        {sections.map((s) => (
          <NavItem
            key={s.id}
            icon={s.icon}
            label={s.label}
            sublabel={s.sublabel}
            badge={s.badge}
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
            {/*
             * Default tone, not `muted` (#1623). The divider and the bottom
             * pin already set this group apart; a dimmer text token on top
             * made Settings the one row a step darker than the footer rows
             * sitting right under it (the Claude row and the account row are
             * text-secondary), which read as a disabled row in dark mode.
             */}
            {utilitySections.map((s) => (
              <NavItem
                key={s.id}
                icon={s.icon}
                label={s.label}
                sublabel={s.sublabel}
                badge={s.badge}
                active={activeSection === s.id}
                collapsed={collapsed}
                onClick={() => onNavigate(s.id)}
              />
            ))}
          </>
        )}
      </nav>

      {/* Footer: launch Claude + user + sign out */}
      <div className="shrink-0 space-y-1 border-t border-lumen-border p-2">
        {launchClaudeLabel && (
          <button
            type="button"
            onClick={onLaunchClaude}
            aria-label={launchClaudeLabel}
            title={collapsed ? launchClaudeLabel : undefined}
            className={cn(
              "flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-sm",
              "text-lumen-text-secondary transition-colors hover:bg-lumen-hover",
              "hover:text-lumen-text focus-visible:outline-none focus-visible:ring-2",
              "focus-visible:ring-lumen-accent",
              collapsed && "justify-center px-0",
            )}
          >
            <span aria-hidden="true" className="shrink-0">
              <TerminalIcon size={18} />
            </span>
            {!collapsed && (
              <span className="flex-1 truncate text-left">
                {launchClaudeLabel}
              </span>
            )}
          </button>
        )}
        {collapsed ? (
          <IconButton
            icon={<LogOut size={18} />}
            label={labels.signOut}
            onClick={onSignOut}
            className="mx-auto"
          />
        ) : (
          <div className="flex items-center gap-1.5 px-1">
            {profileLabel ? (
              /*
               * #1624 — the account row is the way into the profile. The
               * visible text is the name (or the address when none is set);
               * the "Edit profile" copy rides along for assistive tech so the
               * button says what pressing it does, and the address stays one
               * hover away since the name has taken its place.
               */
              <button
                type="button"
                onClick={onOpenProfile}
                title={userEmail}
                className={cn(
                  "-mx-1 min-w-0 flex-1 truncate rounded-md px-1 py-0.5 text-left text-xs",
                  "text-lumen-text-secondary transition-colors hover:bg-lumen-hover",
                  "hover:text-lumen-text focus-visible:outline-none focus-visible:ring-2",
                  "focus-visible:ring-lumen-accent",
                )}
              >
                {accountText}
                <span className="sr-only"> {profileLabel}</span>
              </button>
            ) : (
              <span
                className="min-w-0 flex-1 truncate text-xs text-lumen-text-secondary"
                title={userEmail}
              >
                {accountText}
              </span>
            )}
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
