import { useTranslation } from 'react-i18next';

interface TodaySessionSummaryProps {
  sessions: number;
  totalMinutes: number;
}

export function TodaySessionSummary({ sessions, totalMinutes }: TodaySessionSummaryProps) {
  const { t } = useTranslation();

  if (sessions === 0) return null;

  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const timeStr = hours > 0
    ? t('analytics.hours', { hours, minutes: mins })
    : `${mins}m`;

  return (
    <div className="flex items-center gap-4 text-xs text-notion-text-secondary">
      <span>{t('pomodoro.todaySessions')}: {sessions}</span>
      <span>{t('pomodoro.todayWorkTime')}: {timeStr}</span>
    </div>
  );
}
