import type { ReactNode } from "react";

/*
 * The card the briefing's Todo completion chart sits on, kept from the retired
 * Analytics section (#2754) so the panel looks the same. It carries no charting
 * code, which is why the lazy chart's placeholder can draw it before recharts
 * arrives. Opaque face + border (§3.5 / §5 — no transparency).
 */
export interface ChartCardProps {
  /** Already-translated card title (§6.4). */
  title: string;
  children: ReactNode;
}

export function ChartCard({
  title,
  children,
}: ChartCardProps): React.JSX.Element {
  return (
    <section className="flex flex-col gap-3 rounded-lumen-lg border border-lumen-border bg-lumen-bg-secondary p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-lumen-text">{title}</h3>
      </div>
      {children}
    </section>
  );
}
