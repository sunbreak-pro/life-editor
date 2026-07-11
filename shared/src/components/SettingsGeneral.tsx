import { Rocket } from "lucide-react";
import { cn } from "./cn";

export interface SettingsGeneralOption {
  /** "last" or a SectionId. */
  value: string;
  label: string;
}

export interface SettingsGeneralProps {
  /** Current startup preference ("last" | SectionId). */
  value: string;
  onChange: (value: string) => void;
  /** Startup options: the "resume" entry first, then each section. */
  options: SettingsGeneralOption[];
  /** Already-translated copy (CLAUDE.md §6.4: no useTranslation here). */
  labels: {
    heading: string;
    description: string;
    sectionLabel: string;
  };
}

/*
 * General settings card (§216 lightweight prefs). Pure / props-injected: the
 * startup-section preference + setter come from the host (useStartupSectionPref)
 * and the option list is built host-side from the section registry + a "resume"
 * entry, already translated. lumen-* tokens only, opaque surface (CLAUDE.md §5 /
 * §6.4). Native <select> for accessible, compact selection across 7 sections.
 */
export function SettingsGeneral({
  value,
  onChange,
  options,
  labels,
}: SettingsGeneralProps) {
  return (
    <div className="flex flex-col gap-3" data-section-id="general">
      <div className="flex flex-col gap-1">
        <h3 className="flex items-center gap-2 text-base font-semibold text-lumen-text">
          <Rocket size={16} className="text-lumen-text-secondary" />
          <span>{labels.heading}</span>
        </h3>
        <p className="text-sm text-lumen-text-secondary">
          {labels.description}
        </p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-lumen-text">
          {labels.sectionLabel}
        </span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "w-full rounded-lumen-md border border-lumen-border bg-lumen-bg px-3 py-2 text-sm text-lumen-text",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
          )}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
