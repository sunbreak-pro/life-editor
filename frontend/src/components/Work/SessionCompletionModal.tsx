import { useEffect, useState, useRef } from 'react';
import { Coffee, Clock, CheckCircle2, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SessionCompletionModalProps {
  completedSessionType: 'WORK' | 'REST';
  onExtend: (minutes: number) => void;
  onStartRest: () => void;
  onStartWork: () => void;
  onDismiss: () => void;
  onCompleteTask?: () => void;
  autoStartBreaks?: boolean;
}

const EXTEND_OPTIONS = [5, 10, 15, 20, 25, 30];
const AUTO_START_COUNTDOWN = 3;

export function SessionCompletionModal({
  completedSessionType,
  onExtend,
  onStartRest,
  onStartWork,
  onDismiss,
  onCompleteTask,
  autoStartBreaks,
}: SessionCompletionModalProps) {
  const { t } = useTranslation();
  const [countdown, setCountdown] = useState(AUTO_START_COUNTDOWN);
  const countdownRef = useRef<number | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);

  // Auto-start breaks countdown
  useEffect(() => {
    if (!autoStartBreaks || completedSessionType !== 'WORK') return;

    setCountdown(AUTO_START_COUNTDOWN);
    countdownRef.current = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          onStartRest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [autoStartBreaks, completedSessionType, onStartRest]);

  const isRest = completedSessionType === 'REST';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={onDismiss}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative z-10 w-full max-w-sm mx-4 bg-notion-bg rounded-xl shadow-2xl border border-notion-border p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-notion-text text-center mb-4">
          {isRest ? t('sessionModal.restComplete') : t('sessionModal.workComplete')}
        </h2>

        {isRest ? (
          <div className="space-y-4">
            <button
              onClick={onStartWork}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-notion-accent text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
            >
              <Play size={18} />
              {t('sessionModal.getStarted')}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <button
              onClick={onStartRest}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-notion-accent text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
            >
              <Coffee size={18} />
              {t('sessionModal.takeBreak')}
              {autoStartBreaks && countdown > 0 && (
                <span className="ml-1 text-sm opacity-80">({countdown})</span>
              )}
            </button>

            {onCompleteTask && (
              <button
                onClick={onCompleteTask}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
              >
                <CheckCircle2 size={18} />
                {t('sessionModal.completeTask')}
              </button>
            )}

            <div>
              <p className="text-sm text-notion-text-secondary mb-2 text-center">{t('sessionModal.extend')}</p>
              <div className="grid grid-cols-3 gap-2">
                {EXTEND_OPTIONS.map((min) => (
                  <button
                    key={min}
                    onClick={() => onExtend(min)}
                    className="flex items-center justify-center gap-1 px-3 py-2 text-sm text-notion-text bg-notion-hover rounded-lg hover:bg-notion-border transition-colors"
                  >
                    <Clock size={14} />
                    {t('sessionModal.minutes', { min })}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
