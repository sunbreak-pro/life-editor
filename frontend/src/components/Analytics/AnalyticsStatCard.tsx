interface AnalyticsStatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  subtitle?: string;
}

export function AnalyticsStatCard({
  icon,
  label,
  value,
  color,
  subtitle,
}: AnalyticsStatCardProps) {
  return (
    <div className="bg-notion-bg-secondary rounded-lg p-4 flex items-center gap-3">
      <div className={color}>{icon}</div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-notion-text truncate">{value}</p>
        <p className="text-xs text-notion-text-secondary truncate">{label}</p>
        {subtitle && (
          <p className="text-[10px] text-notion-text-secondary truncate">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
