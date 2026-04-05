import { useRef, useState } from "react";
import {
  CheckSquare,
  CalendarClock,
  StickyNote,
  BookOpen,
  Check,
  ChevronDown,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useClickOutside } from "../../../../hooks/useClickOutside";
import type { ConversionRole } from "../../../../hooks/useRoleConversion";
import { CALENDAR_ITEM_COLORS } from "../../../../types/calendarItem";

const ROLE_CONFIG: Record<
  ConversionRole,
  {
    icon: typeof CheckSquare;
    color: string;
    badgeClass: string;
    i18nKey: string;
  }
> = {
  task: {
    icon: CheckSquare,
    color: "#6B7280",
    badgeClass: "bg-notion-accent/10 text-notion-accent",
    i18nKey: "calendar.roleTask",
  },
  event: {
    icon: CalendarClock,
    color: CALENDAR_ITEM_COLORS.event,
    badgeClass: "bg-purple-100 text-purple-700",
    i18nKey: "calendar.roleEvent",
  },
  note: {
    icon: StickyNote,
    color: CALENDAR_ITEM_COLORS.note,
    badgeClass: "bg-blue-100 text-blue-700",
    i18nKey: "calendar.roleNote",
  },
  daily: {
    icon: BookOpen,
    color: CALENDAR_ITEM_COLORS.daily,
    badgeClass: "bg-amber-100 text-amber-700",
    i18nKey: "calendar.roleDaily",
  },
};

const ROLES: ConversionRole[] = ["task", "event", "note", "daily"];

interface RoleSwitcherProps {
  currentRole: ConversionRole;
  disabledRoles?: ConversionRole[];
  onSelectRole: (role: ConversionRole) => void;
}

export function RoleSwitcher({
  currentRole,
  disabledRoles = [],
  onSelectRole,
}: RoleSwitcherProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useClickOutside(ref, () => setIsOpen(false), isOpen);

  const current = ROLE_CONFIG[currentRole];
  const CurrentIcon = current.icon;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded-full font-medium transition-colors hover:opacity-80 ${current.badgeClass}`}
      >
        <CurrentIcon size={10} />
        {t(current.i18nKey)}
        <ChevronDown size={8} className="opacity-60" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 z-[60] w-36 bg-notion-bg border border-notion-border rounded-lg shadow-xl py-1">
          {ROLES.map((role) => {
            const config = ROLE_CONFIG[role];
            const Icon = config.icon;
            const isCurrent = role === currentRole;
            const isDisabled = disabledRoles.includes(role);

            return (
              <button
                key={role}
                disabled={isDisabled || isCurrent}
                onClick={() => {
                  onSelectRole(role);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                  isDisabled
                    ? "text-notion-text-secondary/40 cursor-not-allowed"
                    : isCurrent
                      ? "text-notion-text font-medium bg-notion-hover/50"
                      : "text-notion-text-secondary hover:bg-notion-hover hover:text-notion-text"
                }`}
              >
                <Icon size={12} style={{ color: config.color }} />
                <span className="flex-1 text-left">{t(config.i18nKey)}</span>
                {isCurrent && (
                  <Check size={12} className="text-notion-accent shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
