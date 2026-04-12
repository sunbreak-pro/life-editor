import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Check, Plus } from "lucide-react";
import type { PropertyType, SelectOption } from "../../types/database";

export const SELECT_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
];

interface CellEditorProps {
  type: PropertyType;
  value: string;
  options?: SelectOption[];
  onChange: (value: string) => void;
  onClose: () => void;
  onCreateOption?: (label: string) => SelectOption;
}

export function CellEditor({
  type,
  value,
  options,
  onChange,
  onClose,
  onCreateOption,
}: CellEditorProps) {
  const { t } = useTranslation();
  switch (type) {
    case "checkbox":
      return null;
    case "select":
      return (
        <SelectEditor
          value={value}
          options={options ?? []}
          onChange={onChange}
          onClose={onClose}
          onCreateOption={onCreateOption}
          createLabel={t("database.createOption")}
          searchPlaceholder={t("database.searchOrCreate")}
        />
      );
    case "number":
      return (
        <NumberEditor value={value} onChange={onChange} onClose={onClose} />
      );
    case "date":
      return <DateEditor value={value} onChange={onChange} onClose={onClose} />;
    case "text":
    default:
      return <TextEditor value={value} onChange={onChange} onClose={onClose} />;
  }
}

function TextEditor({
  value,
  onChange,
  onClose,
}: {
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const commit = useCallback(() => {
    if (draft !== value) onChange(draft);
    onClose();
  }, [draft, value, onChange, onClose]);

  return (
    <input
      ref={ref}
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") onClose();
        e.stopPropagation();
      }}
      className="w-full h-full px-2 py-1 text-xs bg-transparent border-none outline-none focus:ring-1 focus:ring-notion-accent rounded"
    />
  );
}

function NumberEditor({
  value,
  onChange,
  onClose,
}: {
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const commit = useCallback(() => {
    if (draft !== value) onChange(draft);
    onClose();
  }, [draft, value, onChange, onClose]);

  return (
    <input
      ref={ref}
      type="number"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") onClose();
        e.stopPropagation();
      }}
      className="w-full h-full px-2 py-1 text-xs bg-transparent border-none outline-none focus:ring-1 focus:ring-notion-accent rounded tabular-nums"
    />
  );
}

function DateEditor({
  value,
  onChange,
  onClose,
}: {
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <input
      ref={ref}
      type="date"
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
      }}
      onBlur={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
        e.stopPropagation();
      }}
      className="w-full h-full px-2 py-1 text-xs bg-transparent border-none outline-none focus:ring-1 focus:ring-notion-accent rounded"
    />
  );
}

function SelectEditor({
  value,
  options,
  onChange,
  onClose,
  onCreateOption,
  createLabel,
  searchPlaceholder,
}: {
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
  onClose: () => void;
  onCreateOption?: (label: string) => SelectOption;
  createLabel: string;
  searchPlaceholder: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const filtered = search.trim()
    ? options.filter((o) =>
        o.label.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : options;

  const exactMatch = options.some(
    (o) => o.label.toLowerCase() === search.trim().toLowerCase(),
  );
  const showCreate = onCreateOption && search.trim().length > 0 && !exactMatch;

  const handleCreate = () => {
    if (!onCreateOption || !search.trim()) return;
    const newOption = onCreateOption(search.trim());
    onChange(newOption.id);
    onClose();
  };

  return (
    <div
      ref={ref}
      className="absolute z-30 top-full left-0 mt-1 min-w-[180px] max-w-[280px] bg-notion-bg border border-notion-border rounded-md shadow-lg py-1"
    >
      <div className="px-1.5 pb-1">
        <input
          ref={inputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && showCreate) {
              handleCreate();
            } else if (e.key === "Escape") {
              onClose();
            }
            e.stopPropagation();
          }}
          placeholder={searchPlaceholder}
          className="w-full px-1.5 py-1 text-xs bg-transparent rounded border border-notion-border outline-none focus:ring-1 focus:ring-notion-accent"
        />
      </div>
      <div className="max-h-[200px] overflow-y-auto">
        {filtered.map((option) => (
          <button
            key={option.id}
            onClick={() => {
              onChange(value === option.id ? "" : option.id);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2 py-1 text-xs hover:bg-notion-hover text-left"
          >
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: option.color }}
            />
            <span className="flex-1 truncate">{option.label}</span>
            {value === option.id && (
              <Check size={12} className="text-notion-accent shrink-0" />
            )}
          </button>
        ))}
        {showCreate && (
          <button
            onClick={handleCreate}
            className="w-full flex items-center gap-2 px-2 py-1 text-xs hover:bg-notion-hover text-left text-notion-text-secondary"
          >
            <Plus size={12} className="shrink-0" />
            <span>
              {createLabel}{" "}
              <span className="font-medium text-notion-text">
                {search.trim()}
              </span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
