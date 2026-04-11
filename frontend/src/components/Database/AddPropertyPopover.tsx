import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Type, Hash, List, Calendar, CheckSquare, Plus } from "lucide-react";
import type { PropertyType } from "../../types/database";

const PROPERTY_TYPES: {
  type: PropertyType;
  labelKey: string;
  icon: typeof Type;
}[] = [
  { type: "text", labelKey: "database.types.text", icon: Type },
  { type: "number", labelKey: "database.types.number", icon: Hash },
  { type: "select", labelKey: "database.types.select", icon: List },
  { type: "date", labelKey: "database.types.date", icon: Calendar },
  { type: "checkbox", labelKey: "database.types.checkbox", icon: CheckSquare },
];

interface AddPropertyPopoverProps {
  onAdd: (name: string, type: PropertyType) => void;
}

const POPOVER_WIDTH = 208;
const POPOVER_MAX_HEIGHT = 260;

export function AddPropertyPopover({ onAdd }: AddPropertyPopoverProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const btnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [popoverPos, setPopoverPos] = useState<{
    top: number;
    left: number;
  } | null>(null);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const handleToggle = () => {
    if (!isOpen && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      let top = rect.bottom + 4;
      let left = rect.right - POPOVER_WIDTH;

      // Viewport boundary checks
      if (left < 8) left = 8;
      if (left + POPOVER_WIDTH > window.innerWidth - 8) {
        left = window.innerWidth - POPOVER_WIDTH - 8;
      }
      if (top + POPOVER_MAX_HEIGHT > window.innerHeight - 8) {
        top = rect.top - POPOVER_MAX_HEIGHT - 4;
        if (top < 8) top = 8;
      }

      setPopoverPos({ top, left });
      setIsOpen(true);
    } else {
      setIsOpen(false);
      setName("");
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setName("");
  };

  const handleAdd = (type: PropertyType) => {
    onAdd(name.trim() || t("database.propertyDefaultName"), type);
    handleClose();
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="flex items-center gap-1 px-2 py-1.5 text-xs text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover rounded transition-colors"
      >
        <Plus size={12} />
      </button>
      {isOpen &&
        createPortal(
          <>
            <div
              style={{ position: "fixed", inset: 0, zIndex: 99 }}
              onClick={handleClose}
            />
            <div
              style={{
                position: "fixed",
                top: popoverPos?.top ?? 0,
                left: popoverPos?.left ?? 0,
                zIndex: 100,
              }}
              className="w-52 bg-notion-bg border border-notion-border rounded-lg shadow-lg py-1"
            >
              <div className="px-2 py-1.5">
                <input
                  ref={inputRef}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("database.propertyNamePlaceholder")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAdd("text");
                    if (e.key === "Escape") handleClose();
                    e.stopPropagation();
                  }}
                  className="w-full px-2 py-1 text-xs bg-transparent rounded border border-notion-border outline-none focus:ring-1 focus:ring-notion-accent"
                />
              </div>
              <div className="border-t border-notion-border mt-1 pt-1">
                <p className="px-3 py-1 text-[10px] font-medium text-notion-text-secondary uppercase tracking-wider">
                  {t("database.typeLabel")}
                </p>
                {PROPERTY_TYPES.map(({ type, labelKey, icon: Icon }) => (
                  <button
                    key={type}
                    onClick={() => handleAdd(type)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-notion-hover text-left text-notion-text"
                  >
                    <Icon size={14} className="text-notion-text-secondary" />
                    {t(labelKey)}
                  </button>
                ))}
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
