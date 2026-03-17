import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { getDataService } from "../services";
import type {
  ChaosMode,
  ChaosSettings,
  OracleResult,
  TimeCapsuleResult,
  DriftResult,
} from "../types/chaos";

interface ChaosContextValue {
  mode: ChaosMode;
  oracle: OracleResult | null;
  timeCapsules: TimeCapsuleResult[];
  drift: DriftResult | null;
  settings: ChaosSettings;
  isLoading: boolean;
  dataInsufficient: boolean;
  refreshOracle: () => Promise<void>;
  updateSetting: (key: string, value: string) => Promise<void>;
}

const defaultSettings: ChaosSettings = {
  oracle_enabled: true,
  timecapsule_enabled: true,
  drift_enabled: true,
  oracle_min_age_days: 7,
};

const ChaosContext = createContext<ChaosContextValue>({
  mode: "oracle",
  oracle: null,
  timeCapsules: [],
  drift: null,
  settings: defaultSettings,
  isLoading: true,
  dataInsufficient: false,
  refreshOracle: async () => {},
  updateSetting: async () => {},
});

export function useChaosContext(): ChaosContextValue {
  return useContext(ChaosContext);
}

function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
}

const MIN_DATA_COUNT = 20;

export function ChaosProvider({ children }: { children: ReactNode }) {
  const [oracle, setOracle] = useState<OracleResult | null>(null);
  const [timeCapsules, setTimeCapsules] = useState<TimeCapsuleResult[]>([]);
  const [drift, setDrift] = useState<DriftResult | null>(null);
  const [settings, setSettings] = useState<ChaosSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [dataInsufficient, setDataInsufficient] = useState(false);
  const [mode, setMode] = useState<ChaosMode>("oracle");
  const initializedRef = useRef(false);

  const initialize = useCallback(async () => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const ds = getDataService();
    try {
      const [loadedSettings, oracleResult, capsules, driftResult] =
        await Promise.all([
          ds.getChaosSettings(),
          ds.getChaosOracle(),
          ds.getChaosTimeCapsules(getTodayString()),
          ds.getChaosDrift(),
        ]);

      setSettings(loadedSettings);
      setOracle(oracleResult);
      setTimeCapsules(capsules);
      setDrift(driftResult);

      // Data insufficiency is signaled by oracle returning null
      // We check this separately — the backend knows entity count
      if (!oracleResult && !capsules.length && !driftResult) {
        setDataInsufficient(true);
      }

      // Auto-select mode: prioritize time capsule if available
      if (capsules.length > 0 && loadedSettings.timecapsule_enabled) {
        setMode("timecapsule");
      } else if (oracleResult && loadedSettings.oracle_enabled) {
        setMode("oracle");
      } else if (driftResult && loadedSettings.drift_enabled) {
        setMode("drift");
      }
    } catch {
      // Silent fail — widget simply won't display
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  const refreshOracle = useCallback(async () => {
    const ds = getDataService();
    try {
      const result = await ds.refreshChaosOracle();
      setOracle(result);
      setMode("oracle");
    } catch {
      // Silent fail
    }
  }, []);

  const updateSetting = useCallback(async (key: string, value: string) => {
    const ds = getDataService();
    try {
      const updated = await ds.setChaosSettings(key, value);
      setSettings(updated);
    } catch {
      // Silent fail
    }
  }, []);

  return (
    <ChaosContext.Provider
      value={{
        mode,
        oracle,
        timeCapsules,
        drift,
        settings,
        isLoading,
        dataInsufficient,
        refreshOracle,
        updateSetting,
      }}
    >
      {children}
    </ChaosContext.Provider>
  );
}
