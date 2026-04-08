import { useState, useRef, useEffect } from "react";
import { Type, Hash, List, Calendar, CheckSquare, Trash2 } from "lucide-react";
import type { PropertyType, DatabaseProperty } from "../../types/database";

const TYPE_ICONS: Record<PropertyType, typeof Type> = {
  text: Type,
  number: Hash,
  select: List,
  date: Calendar,
  checkbox: CheckSquare,
};

interface PropertyHeaderProps {
  property: DatabaseProperty;
  onUpdate: (updates: {
    name?: string;
    type?: PropertyType;
    config?: DatabaseProperty["config"];
  }) => void;
  onRemove: () => void;
}

export function PropertyHeader({
  property,
  onUpdate,
  onRemove,
}: PropertyHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(property.name);
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

  return (
    <div className="group flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-notion-text-secondary select-none min-w-[120px]">
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
          className="flex-1 min-w-0 truncate cursor-pointer"
          onDoubleClick={() => setIsEditing(true)}
        >
          {property.name}
        </span>
      )}
      <button
        onClick={onRemove}
        className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 text-notion-text-secondary hover:text-red-400 transition-opacity"
      >
        <Trash2 size={10} />
      </button>
    </div>
  );
}
