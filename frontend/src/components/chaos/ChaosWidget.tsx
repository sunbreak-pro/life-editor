import { RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useChaos } from "../../hooks/useChaos";
import { OracleCard } from "./OracleCard";
import { TimeCapsuleCard } from "./TimeCapsuleCard";
import { DriftCard } from "./DriftCard";
import type { SectionId } from "../../types/taskTree";
import type { TimeCapsuleResult } from "../../types/chaos";
import { useCallback } from "react";

interface ChaosWidgetProps {
  onNavigate: (section: SectionId, entityId?: string) => void;
}

export function ChaosWidget({ onNavigate }: ChaosWidgetProps) {
  const { t } = useTranslation();
  const {
    mode,
    oracle,
    timeCapsules,
    drift,
    isLoading,
    dataInsufficient,
    refreshOracle,
  } = useChaos();

  const handleOracleClick = useCallback(() => {
    if (!oracle) return;
    onNavigate("ideas", oracle.entityId);
  }, [oracle, onNavigate]);

  const handleTimeCapsuleClick = useCallback(
    (item: TimeCapsuleResult) => {
      onNavigate("ideas", item.entityId);
    },
    [onNavigate],
  );

  const handleDriftClick = useCallback(() => {
    if (!drift) return;
    onNavigate("ideas", drift.destination.entityId);
  }, [drift, onNavigate]);

  if (isLoading) return null;

  if (dataInsufficient) {
    return (
      <div className="px-3 py-2">
        <p className="text-scaling-xs text-notion-text-secondary leading-relaxed">
          {t("chaos.dataInsufficient")}
        </p>
      </div>
    );
  }

  const hasContent =
    (mode === "oracle" && oracle) ||
    (mode === "timecapsule" && timeCapsules.length > 0) ||
    (mode === "drift" && drift);

  if (!hasContent) return null;

  return (
    <div className="px-3 pb-2">
      <div className="relative">
        {mode === "oracle" && oracle && (
          <OracleCard data={oracle} onClick={handleOracleClick} />
        )}
        {mode === "timecapsule" && timeCapsules.length > 0 && (
          <TimeCapsuleCard
            items={timeCapsules}
            onClick={handleTimeCapsuleClick}
          />
        )}
        {mode === "drift" && drift && (
          <DriftCard data={drift} onClick={handleDriftClick} />
        )}
        {mode === "oracle" && (
          <button
            onClick={refreshOracle}
            className="absolute top-2 right-2 p-1 text-notion-text-secondary hover:text-notion-text rounded transition-colors opacity-0 group-hover:opacity-100 hover:opacity-100"
            title={t("chaos.refresh")}
          >
            <RefreshCw size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
