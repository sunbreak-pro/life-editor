import type { ReactNode } from "react";
import { cn } from "./cn";

export interface NavItemProps {
  /** Already-sized icon node (e.g. a lucide-react icon). */
  icon: ReactNode;
  /** Already-translated label (props-injected i18n, §6.4). */
  label: string;
  active?: boolean;
  /** Icon-only mode (collapsed sidebar). Label is kept as a11y name + tooltip. */
  collapsed?: boolean;
  onClick: () => void;
  className?: string;
}

/*
 * Sidebar navigation row primitive (W5 app shell). Icon + label, with a
 * collapsed (icon-only) variant for the narrow sidebar. lumen-* tokens
 * only (§6.4); the active row uses the opaque hover token + accent icon
 * (no transparency on the container, §5). Copy is injected as `label`
 * (no useTranslation here).
 */
export function NavItem({
  icon,
  label,
  active = false,
  collapsed = false,
  onClick,
  className,
}: NavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm",
        "transition-colors focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-lumen-accent",
        collapsed && "justify-center px-0",
        active
          ? "bg-lumen-hover font-medium text-lumen-text"
          : "text-lumen-text-secondary hover:bg-lumen-hover hover:text-lumen-text",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("shrink-0", active && "text-lumen-accent")}
      >
        {icon}
      </span>
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}
