import { Check, Command, Info, Type } from "lucide-react";
import { cn } from "./cn";

export interface SettingsDetailTip {
  title: string;
  body: string;
}

export interface SettingsDetailTask {
  label: string;
  done: boolean;
}

export interface SettingsDetailPanelProps {
  /** Current body font size in px — the preview reflects live changes. */
  fontPx: number;
  tasks: SettingsDetailTask[];
  tips: SettingsDetailTip[];
  /** Already-translated copy (CLAUDE.md §6.4: no useTranslation here). */
  labels: {
    previewHeading: string;
    windowTitle: string;
    previewTitle: string;
    /** e.g. "テーマ: ライト · 文字サイズ 16px（4/10）". */
    appearanceSummary: string;
    tipsHeading: string;
  };
}

const TIP_ICONS = [Info, Type, Command] as const;

/*
 * Settings rightSidebar body (design 1i). Pure / props-injected (§6.4),
 * lumen-* tokens, opaque surfaces (§5). Rendered into the shared detail panel
 * via RightSidebarPortal by the host. Shows a live appearance preview
 * (theme + font size reflected) and a few usage tips. The design's "ヘルプ
 * センターを開く" button is intentionally omitted (no destination exists).
 */
export function SettingsDetailPanel({
  fontPx,
  tasks,
  tips,
  labels,
}: SettingsDetailPanelProps) {
  return (
    <div className="flex flex-col gap-[18px] p-4">
      <section className="flex flex-col gap-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-lumen-text-tertiary">
          {labels.previewHeading}
        </span>

        <div className="overflow-hidden rounded-lumen-lg border border-lumen-border bg-lumen-bg shadow-lumen-sm">
          <div className="flex h-[30px] items-center gap-1.5 border-b border-lumen-border bg-lumen-bg-subsidebar px-3">
            <span className="h-2 w-2 rounded-full bg-lumen-danger" />
            <span className="h-2 w-2 rounded-full bg-lumen-warning" />
            <span className="h-2 w-2 rounded-full bg-lumen-success" />
            <span className="ml-1.5 text-[11px] text-lumen-text-tertiary">
              {labels.windowTitle}
            </span>
          </div>
          <div className="flex flex-col gap-2.5 p-3.5">
            <span
              className="font-semibold leading-snug text-lumen-text"
              style={{ fontSize: `${fontPx}px` }}
            >
              {labels.previewTitle}
            </span>
            {tasks.map((task, i) => (
              <div key={i} className="flex items-center gap-2">
                <span
                  className={cn(
                    "grid h-4 w-4 shrink-0 place-items-center rounded-[5px] border-[1.5px]",
                    task.done
                      ? "border-lumen-accent bg-lumen-accent text-lumen-on-accent"
                      : "border-lumen-border-strong bg-lumen-bg",
                  )}
                >
                  {task.done && <Check size={9} strokeWidth={3.5} />}
                </span>
                <span
                  className={cn(
                    "leading-snug",
                    task.done
                      ? "text-lumen-text-secondary line-through"
                      : "text-lumen-text",
                  )}
                  style={{ fontSize: `${fontPx}px` }}
                >
                  {task.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <span className="text-xs text-lumen-text-secondary">
          {labels.appearanceSummary}
        </span>
      </section>

      <div className="h-px bg-lumen-border" />

      <section className="flex flex-col gap-3.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-lumen-text-tertiary">
          {labels.tipsHeading}
        </span>
        {tips.map((tip, i) => {
          const Icon = TIP_ICONS[i] ?? Info;
          return (
            <div key={i} className="flex items-start gap-2.5">
              <Icon
                size={16}
                className="mt-0.5 shrink-0 text-lumen-accent"
              />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-lumen-text">
                  {tip.title}
                </span>
                <span className="text-xs leading-relaxed text-lumen-text-secondary">
                  {tip.body}
                </span>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
