import { useState, useMemo, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import {
  getIconNames,
  getDynamicIcon,
  loadAllIcons,
} from "../../utils/iconRenderer";

interface IconPickerProps {
  value?: string;
  onSelect: (iconName: string) => void;
  onClose: () => void;
  anchorRect?: DOMRect | null;
  onRemove?: () => void;
}

const MAX_DISPLAY = 64;

export function IconPicker({
  value,
  onSelect,
  onClose,
  anchorRect,
  onRemove,
}: IconPickerProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [allNames, setAllNames] = useState<string[]>(() => getIconNames());
  const searchRef = useRef<HTMLInputElement>(null);

  // Lazy-load full icon set when picker opens
  useEffect(() => {
    loadAllIcons().then((names) => setAllNames(names));
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return allNames.slice(0, MAX_DISPLAY);
    const q = search.toLowerCase();
    return allNames
      .filter((n) => n.toLowerCase().includes(q))
      .slice(0, MAX_DISPLAY);
  }, [search, allNames]);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const style: React.CSSProperties = anchorRect
    ? { top: anchorRect.bottom + 4, left: anchorRect.left }
    : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

  return (
    <>
      <div className="icon-picker-overlay" onClick={onClose} />
      <div className="icon-picker" style={style}>
        <div className="icon-picker-header">
          <input
            ref={searchRef}
            className="icon-picker-search"
            type="text"
            placeholder={t("iconPicker.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
            }}
          />
          {onRemove && (
            <button
              className="icon-picker-remove-btn"
              onClick={() => {
                onRemove();
                onClose();
              }}
              type="button"
              title={t("iconPicker.remove")}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
        {filtered.length === 0 ? (
          <div className="icon-picker-empty">{t("iconPicker.empty")}</div>
        ) : (
          <div className="icon-picker-grid">
            {filtered.map((name) => {
              const Icon = getDynamicIcon(name);
              if (!Icon) return null;
              return (
                <button
                  key={name}
                  className={`icon-picker-item${value === name ? " selected" : ""}`}
                  title={name}
                  onClick={() => {
                    onSelect(name);
                    onClose();
                  }}
                  type="button"
                >
                  <Icon size={16} />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
