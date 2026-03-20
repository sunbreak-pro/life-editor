export type ChaosEntityType = "memo" | "note";
export type ChaosDisplayType = "oracle" | "timecapsule" | "drift";

export interface ChaosDisplayLog {
  id: string;
  entityId: string;
  entityType: ChaosEntityType;
  displayType: ChaosDisplayType;
  displayedAt: string;
  createdAt: string;
}

export interface OracleResult {
  entityId: string;
  entityType: ChaosEntityType;
  title: string;
  preview: string;
  createdAt: string;
}

export interface TimeCapsuleResult {
  entityId: string;
  entityType: ChaosEntityType;
  title: string;
  preview: string;
  createdAt: string;
  label: string; // e.g., "1年前の今日"
  daysAgo: number;
}

export interface DriftResult {
  origin: {
    entityId: string;
    entityType: ChaosEntityType;
    title: string;
  };
  path: Array<{
    tagId: string;
    tagName: string;
  }>;
  destination: {
    entityId: string;
    entityType: ChaosEntityType;
    title: string;
  };
}

export interface ChaosSettings {
  oracle_enabled: boolean;
  timecapsule_enabled: boolean;
  drift_enabled: boolean;
  oracle_min_age_days: number;
}

export type ChaosMode = "oracle" | "timecapsule" | "drift";

export interface ChaosState {
  mode: ChaosMode;
  oracle: OracleResult | null;
  timeCapsules: TimeCapsuleResult[];
  drift: DriftResult | null;
  settings: ChaosSettings;
  isLoading: boolean;
  dataInsufficient: boolean;
}
