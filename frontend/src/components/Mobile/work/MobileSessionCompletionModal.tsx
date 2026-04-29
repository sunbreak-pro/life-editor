import { useTranslation } from "react-i18next";

interface MobileSessionCompletionModalProps {
  completedSessionType: "WORK" | "REST";
  onExtend: () => void;
  onStartRest: () => void;
  onStartWork: () => void;
  onDismiss: () => void;
}

export function MobileSessionCompletionModal({
  completedSessionType,
  onExtend,
  onStartRest,
  onStartWork,
  onDismiss,
}: MobileSessionCompletionModalProps) {
  const { t } = useTranslation();
  const isWork = completedSessionType === "WORK";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-t-2xl bg-notion-bg p-6 pb-10">
        <h3 className="mb-1 text-center text-lg font-semibold text-notion-text">
          {isWork
            ? t("timer.sessionComplete", "Session Complete!")
            : t("timer.breakOver", "Break Over!")}
        </h3>
        <p className="mb-6 text-center text-sm text-notion-text-secondary">
          {isWork
            ? t("timer.takeBreak", "Time for a break")
            : t("timer.backToWork", "Ready to focus again?")}
        </p>

        <div className="space-y-3">
          {isWork ? (
            <>
              <button
                onClick={onStartRest}
                className="w-full rounded-xl bg-notion-accent py-3 text-sm font-medium text-white active:opacity-80"
              >
                {t("timer.startBreak", "Start Break")}
              </button>
              <button
                onClick={onExtend}
                className="w-full rounded-xl border border-notion-border py-3 text-sm font-medium text-notion-text active:bg-notion-hover"
              >
                {t("timer.extend5min", "Extend +5 min")}
              </button>
            </>
          ) : (
            <button
              onClick={onStartWork}
              className="w-full rounded-xl bg-notion-accent py-3 text-sm font-medium text-white active:opacity-80"
            >
              {t("timer.startWork", "Start Work")}
            </button>
          )}
          <button
            onClick={onDismiss}
            className="w-full py-2 text-center text-sm text-notion-text-secondary active:opacity-60"
          >
            {t("common.dismiss", "Dismiss")}
          </button>
        </div>
      </div>
    </div>
  );
}
