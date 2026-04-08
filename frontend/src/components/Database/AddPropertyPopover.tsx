import { useState, useRef, useEffect } from "react";
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

export function AddPropertyPopover({ onAdd }: AddPropertyPopoverProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
        setName("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const handleAdd = (type: PropertyType) => {
    onAdd(name.trim() || t("database.propertyDefaultName"), type);
    setIsOpen(false);
    setName("");
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-1 px-2 py-1.5 text-xs text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover rounded transition-colors"
      >
        <Plus size={12} />
      </button>
      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-52 bg-notion-bg border border-notion-border rounded-lg shadow-lg z-30 py-1">
          <div className="px-2 py-1.5">
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("database.propertyNamePlaceholder")}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd("text");
                if (e.key === "Escape") {
                  setIsOpen(false);
                  setName("");
                }
                e.stopPropagation();
              }}
              className="w-full px-2 py-1 text-xs bg-notion-hover rounded border border-notion-border outline-none focus:ring-1 focus:ring-notion-accent"
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
      )}
    </div>
  );
}
