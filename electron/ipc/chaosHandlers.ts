import { query } from "./handlerUtil";
import type { ChaosRepository } from "../database/chaosRepository";

export function registerChaosHandlers(repo: ChaosRepository): void {
  query("chaos:oracle:get", "Chaos", "oracle:get", () => repo.getOracle());

  query("chaos:oracle:refresh", "Chaos", "oracle:refresh", () =>
    repo.getOracle(),
  );

  query(
    "chaos:timecapsule:get",
    "Chaos",
    "timecapsule:get",
    (_event, today: string) => repo.getTimeCapsules(today),
  );

  query("chaos:drift:get", "Chaos", "drift:get", () => repo.getDrift());

  query("chaos:settings:get", "Chaos", "settings:get", () =>
    repo.getSettings(),
  );

  query(
    "chaos:settings:set",
    "Chaos",
    "settings:set",
    (_event, key: string, value: string) => {
      repo.setSetting(key, value);
      return repo.getSettings();
    },
  );
}
