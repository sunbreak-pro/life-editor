import { Check } from "lucide-react";
import type { PropertyType, SelectOption } from "../../types/database";

interface CellRendererProps {
  type: PropertyType;
  value: string;
  options?: SelectOption[];
}

export function CellRenderer({ type, value, options }: CellRendererProps) {
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
      if (!value) return null;
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
      return <span className="text-xs tabular-nums">{value}</span>;

    case "date":
      return (
        <span className="text-xs text-notion-text-secondary">{value}</span>
      );

    case "text":
    default:
      return <span className="text-xs">{value}</span>;
  }
}
