import { useState, useRef, useEffect, useCallback } from "react";
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
  onUpdate,
  onRemove,
}: PropertyHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(property.name);
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
    }
  }, [isEditing]);

  const commit = () => {
    if (draft.trim() && draft !== property.name) {
      onUpdate({ name: draft.trim() });
    } else {
      setDraft(property.name);
    }
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
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(property.name);
              setIsEditing(false);
            }
            e.stopPropagation();
          }}
          className="flex-1 min-w-0 bg-transparent border-none outline-none text-xs font-medium text-notion-text"
        />
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
