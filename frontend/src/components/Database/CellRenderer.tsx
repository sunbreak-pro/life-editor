import { Check } from "lucide-react";
import type {
  PropertyType,
  SelectOption,
  OverflowMode,
} from "../../types/database";

interface CellRendererProps {
  type: PropertyType;
  value: string;
  options?: SelectOption[];
  overflow?: OverflowMode;
}

export function CellRenderer({
  type,
  value,
  options,
  overflow = "truncate",
}: CellRendererProps) {
  const textClass =
    overflow === "wrap" ? "whitespace-pre-wrap break-words" : "truncate";
  switch (type) {
    case "checkbox":
      return (
        <div className="flex items-center justify-center h-full">
          {value === "true" ? (
            <div className="w-4 h-4 rounded bg-notion-accent flex items-center justify-center">
              <Check size={12} className="text-white" />
            </div>
          ) : (
            <div className="w-4 h-4 rounded border border-notion-border" />
          )}
        </div>
      );

    case "select": {
      if (!value)
        return (
          <span className="text-notion-text-secondary/40 text-xs">
            Select...
          </span>
        );
      const option = options?.find((o) => o.id === value);
      if (!option)
        return (
          <span className="text-notion-text-secondary text-xs">{value}</span>
        );
      return (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
          style={{
            backgroundColor: `${option.color}20`,
            color: option.color,
          }}
        >
          {option.label}
        </span>
      );
    }

    case "number":
      if (!value)
        return (
          <span className="text-notion-text-secondary/40 text-xs tabular-nums">
            0
          </span>
        );
      return (
        <span className={`text-xs tabular-nums ${textClass}`}>{value}</span>
      );

    case "date":
      if (!value)
        return (
          <span className="text-notion-text-secondary/40 text-xs">
            Pick a date...
          </span>
        );
      return (
        <span className={`text-xs text-notion-text-secondary ${textClass}`}>
          {value}
        </span>
      );

    case "text":
    default:
      if (!value)
        return (
          <span className="text-notion-text-secondary/40 text-xs">
            Type something...
          </span>
        );
      return <span className={`text-xs ${textClass}`}>{value}</span>;
  }
}
