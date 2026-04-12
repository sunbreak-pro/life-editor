import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Type, Hash, List, Calendar, CheckSquare, Trash2 } from "lucide-react";
import type { PropertyType, DatabaseProperty } from "../../types/database";
import { PropertyContextMenu } from "./PropertyContextMenu";

const MIN_COL_WIDTH = 60;
const MAX_COL_WIDTH = 600;

const TYPE_ICONS: Record<PropertyType, typeof Type> = {
  text: Type,
  number: Hash,
  select: List,
  date: Calendar,
  checkbox: CheckSquare,
};

interface PropertyHeaderProps {
  property: DatabaseProperty;
  isFixed?: boolean;
  existingNames?: string[];
  onUpdate: (updates: {
    name?: string;
    type?: PropertyType;
    config?: DatabaseProperty["config"];
  }) => void;
  onRemove: () => void;
}

export function PropertyHeader({
  property,
  isFixed,
  existingNames = [],
  onUpdate,
  onRemove,
}: PropertyHeaderProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(property.name);
  const [nameError, setNameError] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const Icon = TYPE_ICONS[property.type] ?? Type;

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
      setNameError(false);
    }
  }, [isEditing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === property.name) {
      setDraft(property.name);
      setNameError(false);
      setIsEditing(false);
      return;
    }
    const isDuplicate = existingNames.some(
      (n) => n.toLowerCase() === trimmed.toLowerCase(),
    );
    if (isDuplicate) {
      setNameError(true);
      return;
    }
    setNameError(false);
    onUpdate({ name: trimmed });
    setIsEditing(false);
  };

  // --- Column resize ---
  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startWidth = property.config?.width ?? 120;
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);

      const savedCursor = document.body.style.cursor;
      document.body.style.cursor = "col-resize";

      const onMove = (ev: PointerEvent) => {
        const delta = ev.clientX - startX;
        const newWidth = Math.min(
          MAX_COL_WIDTH,
          Math.max(MIN_COL_WIDTH, startWidth + delta),
        );
        const th = target.closest("th") as HTMLElement | null;
        if (th) th.style.width = `${newWidth}px`;
      };

      const onUp = (ev: PointerEvent) => {
        target.releasePointerCapture(ev.pointerId);
        document.body.style.cursor = savedCursor;
        const delta = ev.clientX - startX;
        const newWidth = Math.min(
          MAX_COL_WIDTH,
          Math.max(MIN_COL_WIDTH, startWidth + delta),
        );
        onUpdate({ config: { ...property.config, width: newWidth } });
        target.removeEventListener("pointermove", onMove);
        target.removeEventListener("pointerup", onUp);
      };

      target.addEventListener("pointermove", onMove);
      target.addEventListener("pointerup", onUp);
    },
    [property.config, onUpdate],
  );

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  return (
    <div
      className="group relative flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-notion-text-secondary select-none"
      onContextMenu={handleContextMenu}
    >
      <Icon size={12} className="shrink-0" />
      {isEditing ? (
        <div className="flex-1 min-w-0 relative">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setNameError(false);
            }}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setDraft(property.name);
                setNameError(false);
                setIsEditing(false);
              }
              e.stopPropagation();
            }}
            className={`w-full bg-transparent border-none outline-none text-xs font-medium text-notion-text ${nameError ? "text-red-400" : ""}`}
          />
          {nameError && (
            <div className="absolute left-0 top-full mt-1 px-2 py-1 text-[10px] text-red-400 bg-notion-bg border border-red-400/30 rounded shadow-sm whitespace-nowrap z-40">
              {t("database.invalidName")}
            </div>
          )}
        </div>
      ) : (
        <span
          className={`flex-1 min-w-0 truncate ${isFixed ? "cursor-default" : "cursor-pointer"}`}
          onDoubleClick={() => !isFixed && setIsEditing(true)}
        >
          {property.name}
        </span>
      )}
      {!isFixed && (
        <button
          onClick={onRemove}
          className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 text-notion-text-secondary hover:text-red-400 transition-opacity"
        >
          <Trash2 size={10} />
        </button>
      )}
      {/* Resize handle */}
      <div
        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-notion-accent/40 transition-colors"
        onPointerDown={handleResizePointerDown}
      />

      {/* Context menu */}
      {contextMenu && (
        <PropertyContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          property={property}
          isFixed={isFixed}
          onRename={() => {
            setIsEditing(true);
            setContextMenu(null);
          }}
          onUpdateType={(type) => onUpdate({ type })}
          onUpdateConfig={(config) => onUpdate({ config })}
          onRemove={onRemove}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
