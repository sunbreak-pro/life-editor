import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Tag, Plus, X, Check, MoreHorizontal, Trash2 } from "lucide-react";
import { useCalendarTagsContextOptional } from "../../hooks/useCalendarTagsContextOptional";
import type { CalendarTag } from "../../types/calendarTag";
import { UnifiedColorPicker } from "../shared/UnifiedColorPicker";

const DEFAULT_NEW_TAG_COLOR = "#3b82f6";

interface TagRowProps {
  tag: CalendarTag;
  isActive: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onChangeColor: (color: string) => void;
  onDelete: () => void;
}

function TagRow({
  tag,
  isActive,
  onSelect,
  onRename,
  onChangeColor,
  onDelete,
}: TagRowProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tag.name);
  const [showMenu, setShowMenu] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu && !showColorPicker) return;
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setShowColorPicker(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [showMenu, showColorPicker]);

  const commitRename = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== tag.name) onRename(trimmed);
    else setName(tag.name);
    setEditing(false);
  };

  return (
    <div
      className={`group relative flex items-center gap-2 px-2 py-1 rounded transition-colors ${
        isActive
          ? "bg-notion-accent/10 text-notion-accent"
          : "hover:bg-notion-hover text-notion-text"
      }`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setShowColorPicker((v) => !v);
          setShowMenu(false);
        }}
        className="shrink-0 w-3 h-3 rounded-full ring-1 ring-notion-border hover:scale-110 transition-transform"
        style={{ backgroundColor: tag.color }}
        aria-label={t("calendarTags.changeColor", "Change color")}
      />
      {editing ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") {
              setName(tag.name);
              setEditing(false);
            }
          }}
          className="flex-1 px-1 py-0.5 text-xs bg-notion-bg border border-notion-accent/40 rounded outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={onSelect}
          className="flex-1 text-left text-xs truncate"
        >
          {tag.name}
        </button>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu((v) => !v);
          setShowColorPicker(false);
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-notion-bg"
        aria-label={t("common.more", "More")}
      >
        <MoreHorizontal size={12} />
      </button>

      {showMenu && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full mt-1 z-30 min-w-32 bg-notion-bg border border-notion-border rounded shadow-lg py-1 text-xs"
        >
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setShowMenu(false);
            }}
            className="w-full text-left px-2 py-1 hover:bg-notion-hover"
          >
            {t("common.rename", "Rename")}
          </button>
          <button
            type="button"
            onClick={() => {
              onDelete();
              setShowMenu(false);
            }}
            className="w-full text-left px-2 py-1 hover:bg-notion-hover text-red-500 flex items-center gap-1"
          >
            <Trash2 size={11} /> {t("common.delete", "Delete")}
          </button>
        </div>
      )}

      {showColorPicker && (
        <div ref={menuRef} className="absolute left-0 top-full mt-1 z-30">
          <UnifiedColorPicker
            color={tag.color}
            onChange={onChangeColor}
            onClose={() => setShowColorPicker(false)}
            mode="preset-full"
          />
        </div>
      )}
    </div>
  );
}

export function CalendarTagsPanel() {
  const { t } = useTranslation();
  const ctx = useCalendarTagsContextOptional();

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(DEFAULT_NEW_TAG_COLOR);
  const [showNewColorPicker, setShowNewColorPicker] = useState(false);
  const newColorPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showNewColorPicker) return;
    const onClickOutside = (e: MouseEvent) => {
      if (
        newColorPickerRef.current &&
        !newColorPickerRef.current.contains(e.target as Node)
      ) {
        setShowNewColorPicker(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [showNewColorPicker]);

  const startAdd = useCallback(() => {
    setAdding(true);
    setNewName("");
    setNewColor(DEFAULT_NEW_TAG_COLOR);
  }, []);

  const cancelAdd = useCallback(() => {
    setAdding(false);
    setNewName("");
    setShowNewColorPicker(false);
  }, []);

  const submitAdd = useCallback(async () => {
    if (!ctx) return;
    const trimmed = newName.trim();
    if (!trimmed) {
      cancelAdd();
      return;
    }
    try {
      await ctx.createCalendarTag(trimmed, newColor);
      cancelAdd();
    } catch {
      /* error already logged in hook */
    }
  }, [ctx, newName, newColor, cancelAdd]);

  if (!ctx) return null;
  const {
    calendarTags,
    updateCalendarTag,
    deleteCalendarTag,
    activeFilterTagId,
    setActiveFilterTagId,
  } = ctx;

  return (
    <div className="border border-notion-border/60 rounded-lg p-2 space-y-1.5">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 text-xs font-medium text-notion-text-secondary uppercase tracking-wide">
          <Tag size={12} />
          {t("calendarTags.scheduleTitle", "Schedule Tags")}
        </div>
        <button
          type="button"
          onClick={startAdd}
          className="p-0.5 rounded hover:bg-notion-hover text-notion-text-secondary"
          aria-label={t("calendarTags.add", "Add tag")}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Filter chips: All / Untagged */}
      <div className="flex items-center gap-1 px-1">
        <button
          type="button"
          onClick={() => setActiveFilterTagId(null)}
          className={`text-[11px] px-1.5 py-0.5 rounded ${
            activeFilterTagId === null
              ? "bg-notion-accent/10 text-notion-accent"
              : "text-notion-text-secondary hover:bg-notion-hover"
          }`}
        >
          {t("calendarTags.all", "All")}
        </button>
        <button
          type="button"
          onClick={() =>
            setActiveFilterTagId(
              activeFilterTagId === "untagged" ? null : "untagged",
            )
          }
          className={`text-[11px] px-1.5 py-0.5 rounded ${
            activeFilterTagId === "untagged"
              ? "bg-notion-accent/10 text-notion-accent"
              : "text-notion-text-secondary hover:bg-notion-hover"
          }`}
        >
          {t("calendarTags.untagged", "Untagged")}
        </button>
      </div>

      <div className="space-y-0.5">
        {calendarTags.map((tag) => (
          <TagRow
            key={tag.id}
            tag={tag}
            isActive={activeFilterTagId === tag.id}
            onSelect={() =>
              setActiveFilterTagId(activeFilterTagId === tag.id ? null : tag.id)
            }
            onRename={(name) => updateCalendarTag(tag.id, { name })}
            onChangeColor={(color) => updateCalendarTag(tag.id, { color })}
            onDelete={() => deleteCalendarTag(tag.id)}
          />
        ))}
        {calendarTags.length === 0 && !adding && (
          <div className="px-2 py-1 text-[11px] text-notion-text-secondary italic">
            {t("calendarTags.empty", "No tags yet")}
          </div>
        )}
      </div>

      {adding && (
        <div className="relative flex items-center gap-1 px-1">
          <div ref={newColorPickerRef} className="shrink-0 relative">
            <button
              type="button"
              onClick={() => setShowNewColorPicker((v) => !v)}
              className="w-5 h-5 rounded-full ring-1 ring-notion-border hover:scale-110 transition-transform"
              style={{ backgroundColor: newColor }}
              aria-label={t("calendarTags.color", "Color")}
            />
            {showNewColorPicker && (
              <UnifiedColorPicker
                color={newColor}
                onChange={setNewColor}
                onClose={() => setShowNewColorPicker(false)}
                mode="preset-full"
              />
            )}
          </div>
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitAdd();
              if (e.key === "Escape") cancelAdd();
            }}
            placeholder={t("calendarTags.namePlaceholder", "Tag name")}
            className="flex-1 min-w-0 px-1.5 py-0.5 text-xs bg-notion-bg border border-notion-accent/40 rounded outline-none"
          />
          <button
            type="button"
            onClick={submitAdd}
            className="shrink-0 p-0.5 rounded hover:bg-notion-hover text-notion-accent"
            aria-label={t("common.confirm", "Confirm")}
          >
            <Check size={12} />
          </button>
          <button
            type="button"
            onClick={cancelAdd}
            className="shrink-0 p-0.5 rounded hover:bg-notion-hover text-notion-text-secondary"
            aria-label={t("common.cancel", "Cancel")}
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
