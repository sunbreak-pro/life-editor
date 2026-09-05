import type { ReactNode } from "react";
import {
  PanelLeftClose,
  PanelLeftOpen,
  Command as CommandIcon,
  LogOut,
  Tags as TagsIcon,
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
  /**
   * "Edit tags" footer row (#409). Required for the row to render — with
   * `onOpenTagEditor` it forms the tag-master entry directly above ⌘K.
   */
  tagEditor?: string;
  /**
   * "Launch Claude Code" footer row (#1211). Same two-halves contract as
   * `tagEditor`: the row needs this AND `onLaunchClaude` to render.
   */
  launchClaude?: string;
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
  /**
   * Opens the global tag editor (#409). Rendered as a footer row directly
   * ABOVE the command palette row — tags are a classification axis that lives
   * in the same column as the section list, not a per-screen action in the
   * header. Omit (or omit `labels.tagEditor`) to leave the row out.
   */
  onOpenTagEditor?: () => void;
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
  onOpenTagEditor,
  onLaunchClaude,
  userEmail,
  onSignOut,
  labels,
}: SidebarNavProps) {
  const hasUtility = utilitySections != null && utilitySections.length > 0;
  const brandInitial = labels.appName.charAt(0);
  // Both halves must be present: a row with no handler does nothing, a row
  // with no label would render untranslated (§6.4 — copy is injected).
  const tagEditorLabel = onOpenTagEditor ? labels.tagEditor : undefined;
  const launchClaudeLabel = onLaunchClaude ? labels.launchClaude : undefined;

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
            sublabel={s.sublabel}
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
                sublabel={s.sublabel}
                active={activeSection === s.id}
                collapsed={collapsed}
                tone="muted"
                onClick={() => onNavigate(s.id)}
              />
            ))}
          </>
        )}
      </nav>

      {/* Footer: launch Claude + edit tags + ⌘K (+ keycap) + user + sign out */}
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
        {tagEditorLabel && (
          <button
            type="button"
            onClick={onOpenTagEditor}
            aria-label={tagEditorLabel}
            title={collapsed ? tagEditorLabel : undefined}
            className={cn(
              "flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-sm",
              "text-lumen-text-secondary transition-colors hover:bg-lumen-hover",
              "hover:text-lumen-text focus-visible:outline-none focus-visible:ring-2",
              "focus-visible:ring-lumen-accent",
              collapsed && "justify-center px-0",
            )}
          >
            <span aria-hidden="true" className="shrink-0">
              <TagsIcon size={18} />
            </span>
            {!collapsed && (
              <span className="flex-1 truncate text-left">
                {tagEditorLabel}
              </span>
            )}
          </button>
        )}
        <button
          type="button"
          onClick={onTogglePalette}
          aria-label={labels.commandPalette}
          title={collapsed ? labels.commandPalette : undefined}
          className={cn(
            // `overflow-hidden` is the hard stop behind the #1468 fix below:
            // once the label stops shrinking, nothing else keeps a pathological
            // translation inside the 15rem aside, and it would otherwise paint
            // over the content pane. It clips descendants only, so the
            // focus-visible ring (drawn outside this box) is unaffected.
            "flex h-9 w-full items-center gap-2.5 overflow-hidden rounded-md px-2.5 text-sm",
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
              {/*
               * #1468 — the label owns its width and the keycap yields, not
               * the other way round.
               *
               * This was `flex-1 truncate`, i.e. flex-basis 0: the span took
               * only what the <kbd> left over, so 「コマンドパレット」 was
               * clipped to 「コマンドパレッ…」 inside the 15rem rail. With
               * `basis-auto shrink-0` the label is laid out at its content
               * width first and can never be the item that gives way — which
               * is what holds at every step of the Settings font scale
               * (constants/fontSize.ts), not just the default one. The row's
               * only fixed-px term is the 18px icon below, so the smallest
               * step is the tightest and the one to eyeball. `grow` keeps the
               * keycap flush right exactly as before.
               *
               * Something still has to give when the row is genuinely over
               * budget, so the order is pinned deliberately: the label (the
               * button's actual name) never yields, the keycap (aria-hidden
               * decoration) elides first, and the button's `overflow-hidden`
               * catches anything past that. Both en and ja run close to the
               * budget at the smallest font step, and that ranking is what
               * makes the outcome predictable at every step rather than a
               * coin-flip decided by font metrics.
               */}
              <span className="grow basis-auto shrink-0 whitespace-nowrap text-left">
                {labels.commandPalette}
              </span>
              {labels.shortcutHint && (
                /*
                 * `font-sans` is load-bearing, not cosmetic. Tailwind preflight
                 * puts every <kbd> on --font-mono, and nothing here overrode
                 * it, so the Windows hint "Ctrl K" rendered as six fixed-pitch
                 * advances — far wider than the same string in the UI font the
                 * rest of the row uses, and on its own enough to overrun the
                 * budget. macOS never showed the bug because "⌘K" is two
                 * glyphs. `min-w-0 truncate` makes the keycap the part that
                 * degrades if a future locale ships a longer palette label.
                 *
                 * Yes, this pins a child against the Settings font-family
                 * preference, which is the shape #228 warns about (see the
                 * `html { font-family }` note in web/src/index.css). It is
                 * deliberate and it is the narrower evil: `[font-family:
                 * inherit]` would follow the preference, but it also hands the
                 * Monospace setting the exact metrics that caused this bug.
                 * A keycap is chrome, not body copy.
                 */
                <kbd
                  aria-hidden="true"
                  className="min-w-0 truncate rounded border border-lumen-border bg-lumen-bg px-1 py-px font-sans text-xs text-lumen-text-tertiary"
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
