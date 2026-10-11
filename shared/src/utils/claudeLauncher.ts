/*
 * Renderer half of the Claude Code launcher bridge (#1211).
 *
 * `shared/` must not import from `desktop/` — the same bundle is served to the
 * browser and to the Capacitor shells, where `electron` does not exist — so
 * this re-declares the two methods `desktop/src/shared/ipcContract.ts` exposes,
 * exactly as `supabaseAuthStorage.ts` re-declares the auth-storage half. The
 * two declarations are pinned against each other in
 * `desktop/tests/ipcContract.test.ts`: a signature change on either side fails
 * desktop's typecheck instead of half-landing and rejecting at runtime.
 */

import type { AiCustomizationDataService } from "../services/DataService";

/** Mirrors `ClaudeLaunchError` in the desktop contract. */
export type ClaudeLaunchErrorCode =
  | "no-project-path"
  | "invalid-project-path"
  | "claude-not-found"
  | "prepare-failed"
  | "spawn-failed";

export interface ClaudeLaunchOutcome {
  ok: boolean;
  error?: ClaudeLaunchErrorCode;
}

export interface DesktopClaudeLauncherBridge {
  getClaudeProjectPath(): Promise<string>;
  launchClaude(args: {
    projectPath?: string;
    customization?: ClaudeCustomizationPayload;
  }): Promise<ClaudeLaunchOutcome>;
}

/**
 * The bridge, or null everywhere it does not exist (browser, Capacitor, tests,
 * SSR). Null is the whole gate: the Settings card falls back to a "Desktop
 * only" sentence on it and the sidebar row is simply not rendered, so no
 * caller has to know which host it is running in.
 *
 * Both methods are checked, not just the `desktop` object: an older desktop
 * build exposes `window.desktop` without the launcher, and treating that as
 * present would show a button whose invoke has no handler.
 */
export function getClaudeLauncherBridge(): DesktopClaudeLauncherBridge | null {
  if (typeof window === "undefined") return null;
  const desktop = (
    window as unknown as { desktop?: Partial<DesktopClaudeLauncherBridge> }
  ).desktop;
  if (
    typeof desktop?.launchClaude !== "function" ||
    typeof desktop?.getClaudeProjectPath !== "function"
  ) {
    return null;
  }
  return desktop as DesktopClaudeLauncherBridge;
}
/**
 * What the launch hands main to write into the app's own Claude folder
 * (#2120). Mirrors `ClaudeCustomizationPayload` in the desktop contract.
 * Text only — main writes it into files and never onto a command line.
 */
export interface ClaudeCustomizationPayload {
  rules: string;
  memories: string[];
  skills: { slug: string; description: string; body: string }[];
}

/**
 * Read the rules / memories / skills (#2118) into the launch payload. Throws
 * when a read fails; the caller decides whether to launch without it.
 */
export async function collectClaudeCustomization(
  ds: Pick<
    AiCustomizationDataService,
    "fetchAiRule" | "fetchAiMemories" | "fetchAiSkills"
  >,
): Promise<ClaudeCustomizationPayload> {
  const [rule, memories, skills] = await Promise.all([
    ds.fetchAiRule(),
    ds.fetchAiMemories(),
    ds.fetchAiSkills(),
  ]);
  return {
    rules: rule?.body ?? "",
    memories: memories.map((m) => m.body),
    skills: skills.map(({ slug, description, body }) => ({
      slug,
      description,
      body,
    })),
  };
}
