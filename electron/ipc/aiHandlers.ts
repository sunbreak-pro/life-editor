import { ipcMain } from "electron";
import type { AIRepository } from "../database/aiRepository";
import type { AIAdviceRequest } from "../types";
import { getAdvice } from "../services/aiService";
import { loggedHandler } from "./handlerUtil";

export function registerAIHandlers(repo: AIRepository): void {
  ipcMain.handle("ai:advice", async (_event, request: AIAdviceRequest) => {
    // Priority 1: DB key (set via Settings UI)
    let apiKey = repo.getRawApiKey();
    // Priority 2: Environment variable
    if (!apiKey) {
      apiKey = process.env.SONICFLOW_AI_API_KEY ?? "";
    }
    if (!apiKey) {
      return {
        error: "APIキーが設定されていません。Settingsで設定してください。",
        errorCode: "API_KEY_NOT_CONFIGURED",
      };
    }

    const model = repo.getModel();

    try {
      return await getAdvice(request, apiKey, model);
    } catch (e: unknown) {
      const err = e as { error?: string; errorCode?: string };
      return {
        error: err.error ?? "AI request failed",
        errorCode: err.errorCode ?? "UNKNOWN_ERROR",
      };
    }
  });

  ipcMain.handle(
    "ai:fetchSettings",
    loggedHandler("AI", "fetchSettings", () => {
      return repo.fetchSettings();
    }),
  );

  ipcMain.handle(
    "ai:updateSettings",
    loggedHandler(
      "AI",
      "updateSettings",
      (_event, settings: { apiKey?: string; model?: string }) => {
        return repo.updateSettings(settings);
      },
    ),
  );
}
