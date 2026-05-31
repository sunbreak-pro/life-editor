import {
  Calendar as CalendarIcon,
  Clock,
  List as ListIcon,
  Settings as SettingsIcon,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { C } from "../lib/theme";

/**
 * Global bottom navigation between the 4 primary sections.
 * Previously duplicated in every screen; now rendered once by AppShell.
 */
const TABS = [
  { to: "/schedule", label: "予定", Icon: CalendarIcon },
  { to: "/work", label: "作業", Icon: Clock },
  { to: "/materials", label: "資料", Icon: ListIcon },
  { to: "/settings", label: "設定", Icon: SettingsIcon },
] as const;

export function BottomTabBar() {
  return (
    <nav
      className="flex items-stretch shrink-0"
      style={{
        height: 56,
        background: C.mantle,
        borderTop: `1px solid ${C.surface0}`,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {TABS.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          className="flex-1 flex flex-col items-center justify-center gap-0.5"
          style={({ isActive }) => ({
            color: isActive ? C.mauve : C.overlay0,
            textDecoration: "none",
          })}
        >
          <Icon size={20} />
          <span className="text-[10px]">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
