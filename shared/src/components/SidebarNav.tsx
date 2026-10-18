import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Settings as SettingsIcon,
  Terminal as TerminalIcon,
} from "lucide-react";
import { cn } from "./cn";
import { NavItem } from "./NavItem";
import { IconButton } from "./IconButton";
import { Button } from "./Button";
import { isImeComposing } from "../utils/imeGuard";

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
  /**
   * Sign-out confirmation (#2278): the question ("Sign out?") and the button
   * that backs out of it. With both, the sign-out control opens a small
   * confirm panel whose other button reuses `signOut`; without them it signs
   * out on the first press, as before.
   */
  signOutPrompt?: string;
  cancel?: string;
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
   *
   * Since #2278 that button is also the way into Settings: it carries the
   * gear at its right end (the collapsed rail shows the gear alone, above
   * sign-out), and the host no longer passes a Settings utility row.
   */
  onOpenProfile?: () => void;
  /**
   * Highlights the account button (#2278) — the host passes true while the
   * screen it opens (Settings) is showing, the way the active nav row lights.
   */
  accountActive?: boolean;
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
  accountActive = false,
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
          <>
            {profileLabel && (
              // The rail has no room for the name, so the gear stands in for
              // the whole account button, directly above sign-out (#2278).
              <button
                type="button"
                onClick={onOpenProfile}
                aria-label={profileLabel}
                aria-current={accountActive ? "page" : undefined}
                title={profileLabel}
                className={cn(
                  "mx-auto flex h-8 w-8 items-center justify-center rounded-md",
                  "transition-colors focus-visible:outline-none focus-visible:ring-2",
                  "focus-visible:ring-lumen-accent",
                  accountActive
                    ? "bg-lumen-accent-subtle text-lumen-accent"
                    : "text-lumen-text-secondary hover:bg-lumen-hover hover:text-lumen-text",
                )}
              >
                <SettingsIcon size={18} aria-hidden="true" />
              </button>
            )}
            <SignOutControl
              labels={labels}
              onSignOut={onSignOut}
              size="md"
              className="mx-auto w-fit"
            />
          </>
        ) : (
          <div className="flex items-center gap-1.5 px-1">
            {profileLabel ? (
              /*
               * #1624 — the account row is the way into the profile. The
               * visible text is the name (or the address when none is set);
               * the "Edit profile" copy rides along for assistive tech so the
               * button says what pressing it does, and the address stays one
               * hover away since the name has taken its place.
               *
               * #2278 — the gear at the right end is part of the same button,
               * which replaced the Settings row: one press target, lit while
               * Settings is open.
               */
              <button
                type="button"
                onClick={onOpenProfile}
                title={userEmail}
                aria-current={accountActive ? "page" : undefined}
                className={cn(
                  "-mx-1 flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-xs",
                  "transition-colors focus-visible:outline-none focus-visible:ring-2",
                  "focus-visible:ring-lumen-accent",
                  accountActive
                    ? "bg-lumen-accent-subtle font-medium text-lumen-accent"
                    : "text-lumen-text-secondary hover:bg-lumen-hover hover:text-lumen-text",
                )}
              >
                <span className="min-w-0 flex-1 truncate">
                  {accountText}
                  <span className="sr-only"> {profileLabel}</span>
                </span>
                <SettingsIcon
                  size={14}
                  aria-hidden="true"
                  className="shrink-0"
                />
              </button>
            ) : (
              <span
                className="min-w-0 flex-1 truncate text-xs text-lumen-text-secondary"
                title={userEmail}
              >
                {accountText}
              </span>
            )}
            <SignOutControl labels={labels} onSignOut={onSignOut} size="sm" />
          </div>
        )}
      </div>
    </aside>
  );
}

interface SignOutControlProps {
  labels: SidebarNavLabels;
  onSignOut: () => void;
  size: "sm" | "md";
  className?: string;
}

/*
 * The sign-out button and its confirm panel (#2278). Signing out sat one
 * misclick away from the account row, so the press now opens a small panel
 * just to the RIGHT of the button ("Sign out?" + Cancel / Sign out), and only
 * the panel's own Sign out calls `onSignOut`. Cancel, Esc (IME-guarded) and a
 * pointerdown outside all close it. Not portalled: the wrapper is `relative`
 * and the panel hangs off its right edge over the content column, opaque
 * (bg-lumen-bg) like every other popover. The trigger counts as inside, so
 * pressing it again closes the panel instead of closing-then-reopening it
 * (the same wiring note as <Menu>).
 *
 * Focus goes to Cancel on open — the safe answer is the one Enter picks — and
 * back to the trigger when the panel closes from the keyboard or a button.
 * Without the two labels the button signs out at once, as it did before.
 */
function SignOutControl({
  labels,
  onSignOut,
  size,
  className,
}: SignOutControlProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const promptId = useId();
  const prompt = labels.signOutPrompt;
  const cancel = labels.cancel;
  const asks = prompt != null && cancel != null;

  const dismiss = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onPointer = (e: PointerEvent) => {
      // The panel and the trigger share the wrapper, so one check covers both.
      if (wrapperRef.current?.contains(e.target as Node)) return;
      // A click elsewhere is going somewhere — leave the focus to it.
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (isImeComposing(e)) return;
      if (e.key === "Escape") dismiss();
    };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, dismiss]);

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <IconButton
        ref={triggerRef}
        icon={<LogOut size={size === "sm" ? 16 : 18} />}
        label={labels.signOut}
        size={size}
        aria-haspopup={asks ? "dialog" : undefined}
        aria-expanded={asks ? open : undefined}
        onClick={() => (asks ? setOpen((v) => !v) : onSignOut())}
      />
      {asks && open && (
        <div
          role="dialog"
          aria-labelledby={promptId}
          className={cn(
            "absolute bottom-0 left-full z-50 ml-2 w-max",
            "rounded-lumen-md border border-lumen-border bg-lumen-bg p-3 shadow-lumen-lg",
          )}
        >
          <p id={promptId} className="text-sm font-medium text-lumen-text">
            {prompt}
          </p>
          <div className="mt-3 flex justify-end gap-1.5">
            <Button ref={cancelRef} variant="ghost" size="sm" onClick={dismiss}>
              {cancel}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setOpen(false);
                onSignOut();
              }}
            >
              {labels.signOut}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
