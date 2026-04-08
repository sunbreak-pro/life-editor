import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import type { PropertyType, SelectOption } from "../../types/database";

interface CellEditorProps {
  type: PropertyType;
  value: string;
  options?: SelectOption[];
  onChange: (value: string) => void;
  onClose: () => void;
}

export function CellEditor({
  type,
  value,
  options,
  onChange,
  onClose,
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
          noOptionsLabel={t("database.noOptions")}
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
  noOptionsLabel,
}: {
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
  onClose: () => void;
  noOptionsLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute z-30 top-full left-0 mt-1 min-w-[140px] bg-notion-bg border border-notion-border rounded-md shadow-lg py-1"
    >
      {options.length === 0 && (
        <p className="px-2 py-1 text-xs text-notion-text-secondary">
          {noOptionsLabel}
        </p>
      )}
      {options.map((option) => (
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
    </div>
  );
}
