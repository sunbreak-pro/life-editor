import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe, AppWindow, MoreHorizontal } from "lucide-react";
import type { SidebarLink } from "../../types/sidebarLink";
import {
  LUCIDE_ICON_REGISTRY,
  parseLucideIconName,
} from "./lucideIconRegistry";

interface SidebarLinkItemProps {
  link: SidebarLink;
  iconSize: number;
  textPx: number;
  disabled?: boolean;
  disabledReason?: string;
  onClick: (link: SidebarLink) => void;
  onEdit: (link: SidebarLink) => void;
  onDelete: (link: SidebarLink) => void;
}

export function SidebarLinkItem({
  link,
  iconSize,
  textPx,
  disabled = false,
  disabledReason,
  onClick,
  onEdit,
  onDelete,
}: SidebarLinkItemProps) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  const lucideName = parseLucideIconName(link.emoji);
  const LucideIcon = lucideName ? LUCIDE_ICON_REGISTRY[lucideName] : null;
  const FallbackIcon = link.kind === "app" ? AppWindow : Globe;

  return (
    <div ref={wrapperRef} className="group relative">
      <button
        type="button"
        onClick={() => !disabled && onClick(link)}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenuOpen((v) => !v);
        }}
        disabled={disabled}
        title={disabled ? disabledReason : link.target}
        className={`w-full flex items-center gap-2.5 pl-2.5 pr-7 py-1.5 rounded-md transition-all duration-200 ${
          disabled
            ? "text-notion-text-secondary/50 cursor-not-allowed"
            : "text-notion-text-secondary hover:bg-notion-hover/80 hover:text-notion-text"
        }`}
        style={{ fontSize: textPx, lineHeight: 1.25 }}
      >
        <span
          className="shrink-0 inline-flex items-center justify-center"
          style={{ width: iconSize, height: iconSize }}
        >
          {LucideIcon ? (
            <LucideIcon size={iconSize} />
          ) : link.emoji ? (
            <span className="leading-none" style={{ fontSize: iconSize - 2 }}>
              {link.emoji}
            </span>
          ) : (
            <FallbackIcon size={iconSize} />
          )}
        </span>
        <span className="truncate flex-1 text-left">{link.name}</span>
      </button>

      <button
        type="button"
        aria-label={t("sidebarLinks.itemMenu", "Options")}
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen((v) => !v);
        }}
        className={`absolute right-1.5 top-1/2 -translate-y-1/2 shrink-0 p-0.5 rounded text-notion-text-secondary hover:bg-notion-hover hover:text-notion-text transition-opacity ${
          menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        <MoreHorizontal size={14} />
      </button>

      {menuOpen && (
        <div className="absolute right-1 top-full mt-1 z-30 w-32 bg-notion-bg border border-notion-border rounded-md shadow-lg py-1">
          <button
            type="button"
            className="w-full text-left px-3 py-1.5 text-xs text-notion-text hover:bg-notion-hover"
            onClick={() => {
              setMenuOpen(false);
              onEdit(link);
            }}
          >
            {t("common.edit", "Edit")}
          </button>
          <button
            type="button"
            className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-notion-hover"
            onClick={() => {
              setMenuOpen(false);
              onDelete(link);
            }}
          >
            {t("common.delete", "Delete")}
          </button>
        </div>
      )}
    </div>
  );
}
