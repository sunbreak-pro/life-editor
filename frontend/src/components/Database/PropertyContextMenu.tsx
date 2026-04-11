import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Pencil,
  Trash2,
  ArrowRightLeft,
  WrapText,
  Check,
  Type,
  Hash,
  List,
  Calendar,
  CheckSquare,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type {
  PropertyType,
  DatabaseProperty,
  OverflowMode,
} from "../../types/database";

const PROPERTY_TYPES: {
  type: PropertyType;
  icon: typeof Type;
}[] = [
  { type: "text", icon: Type },
  { type: "number", icon: Hash },
  { type: "select", icon: List },
  { type: "date", icon: Calendar },
  { type: "checkbox", icon: CheckSquare },
];

interface PropertyContextMenuProps {
  x: number;
  y: number;
  property: DatabaseProperty;
  isFixed?: boolean;
  onRename: () => void;
  onUpdateType: (type: PropertyType) => void;
  onUpdateConfig: (config: DatabaseProperty["config"]) => void;
  onRemove: () => void;
  onClose: () => void;
}

export function PropertyContextMenu({
  x,
  y,
  property,
  isFixed,
  onRename,
  onUpdateType,
  onUpdateConfig,
  onRemove,
  onClose,
}: PropertyContextMenuProps) {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);
  const [showTypeSubmenu, setShowTypeSubmenu] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (rect.right > vw) {
      menuRef.current.style.left = `${x - rect.width}px`;
    }
    if (rect.bottom > vh) {
      menuRef.current.style.top = `${y - rect.height}px`;
    }
  }, [x, y]);

  const currentOverflow: OverflowMode = property.config?.overflow ?? "truncate";

  const handleToggleOverflow = () => {
    const newOverflow: OverflowMode =
      currentOverflow === "truncate" ? "wrap" : "truncate";
    onUpdateConfig({ ...property.config, overflow: newOverflow });
    onClose();
  };

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[9999] min-w-[180px] bg-notion-bg border border-notion-border rounded-lg shadow-lg py-1 text-xs"
      style={{ left: x, top: y }}
    >
      {/* Rename */}
      {!isFixed && (
        <button
          onClick={() => {
            onRename();
            onClose();
          }}
          className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-notion-hover text-left text-notion-text"
        >
          <Pencil size={12} />
          {t("database.contextMenu.rename")}
        </button>
      )}

      {/* Change type */}
      <div
        className="relative"
        onMouseEnter={() => setShowTypeSubmenu(true)}
        onMouseLeave={() => setShowTypeSubmenu(false)}
      >
        <button className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-notion-hover text-left text-notion-text">
          <ArrowRightLeft size={12} />
          {t("database.contextMenu.changeType")}
          <span className="ml-auto text-notion-text-secondary">▸</span>
        </button>

        {showTypeSubmenu && (
          <div className="absolute left-full top-0 ml-0.5 min-w-[150px] bg-notion-bg border border-notion-border rounded-lg shadow-lg py-1">
            {PROPERTY_TYPES.map(({ type, icon: Icon }) => (
              <button
                key={type}
                onClick={() => {
                  onUpdateType(type);
                  onClose();
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-notion-hover text-left text-notion-text"
              >
                <Icon size={12} />
                {t(`database.types.${type}`)}
                {property.type === type && (
                  <Check size={12} className="ml-auto text-notion-accent" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cell overflow toggle */}
      <button
        onClick={handleToggleOverflow}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-notion-hover text-left text-notion-text"
      >
        <WrapText size={12} />
        {currentOverflow === "truncate"
          ? t("database.contextMenu.overflow.wrap")
          : t("database.contextMenu.overflow.truncate")}
      </button>

      {/* Separator + Delete */}
      {!isFixed && (
        <>
          <div className="my-1 border-t border-notion-border" />
          <button
            onClick={() => {
              onRemove();
              onClose();
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-notion-hover text-left text-red-400"
          >
            <Trash2 size={12} />
            {t("database.contextMenu.delete")}
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}
