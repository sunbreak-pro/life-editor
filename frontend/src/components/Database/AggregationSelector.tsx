import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AggregationType, PropertyType } from "../../types/database";
import { getAvailableAggregations } from "../../utils/databaseAggregation";

interface AggregationSelectorProps {
  x: number;
  y: number;
  propertyType: PropertyType;
  current: AggregationType;
  onSelect: (aggregation: AggregationType) => void;
  onClose: () => void;
}

export function AggregationSelector({
  x,
  y,
  propertyType,
  current,
  onSelect,
  onClose,
}: AggregationSelectorProps) {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);

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

  const available = getAvailableAggregations(propertyType);

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[9999] min-w-[150px] bg-notion-bg border border-notion-border rounded-lg shadow-lg py-1 text-xs"
      style={{ left: x, top: y }}
    >
      <div className="px-3 py-1 text-[10px] text-notion-text-secondary font-medium uppercase tracking-wider">
        {t("database.aggregation.label")}
      </div>
      {available.map((agg) => (
        <button
          key={agg}
          onClick={() => {
            onSelect(agg);
            onClose();
          }}
          className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-notion-hover text-left text-notion-text"
        >
          {t(`database.aggregation.${agg}`)}
          {current === agg && (
            <Check size={12} className="ml-auto text-notion-accent" />
          )}
        </button>
      ))}
    </div>,
    document.body,
  );
}
