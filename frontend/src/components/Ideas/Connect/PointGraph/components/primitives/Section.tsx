import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, type LucideIcon } from "lucide-react";

interface SectionProps {
  title: string;
  icon?: LucideIcon;
  children: ReactNode;
  defaultOpen?: boolean;
  count?: string | number;
}

export function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
  count,
}: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center justify-between"
      >
        <span className="flex items-center gap-2">
          {Icon && <Icon size={12} className="text-notion-accent" />}
          <span className="text-[10px] uppercase tracking-[0.18em] font-medium text-notion-text-secondary">
            {title}
          </span>
          {count != null && (
            <span className="font-mono text-[9px] px-1 rounded bg-notion-hover text-notion-text-secondary">
              {count}
            </span>
          )}
        </span>
        {open ? (
          <ChevronDown size={12} className="text-notion-text-secondary" />
        ) : (
          <ChevronRight size={12} className="text-notion-text-secondary" />
        )}
      </button>
      {open && <div className="space-y-2">{children}</div>}
    </section>
  );
}
