import { useCallback, useEffect, useMemo, useState } from "react";
import { getClaudeLauncherBridge, useTranslation } from "@life-editor/shared";

/*
 * Host side of the Claude Code launcher (#1211).
 *
 * Two call sites want the same thing at different depths: the Settings card
 * needs the folder field and the sentence to show under it, the sidebar row
 * needs only "launch, and tell me if it failed". Both get this hook — which is
 * also where the failure CODE main returns becomes a sentence, because copy
 * belongs to the host and never to the shared component (§6.4).
 */

export interface ClaudeLauncherApi {
  /** True only on the desktop shell, and only where the preload has the
   *  launcher on it — an older build exposes `window.desktop` without it. */
  available: boolean;
  /** Folder field value, seeded from the folder the last launch saved. */
  projectPath: string;
  setProjectPath: (value: string) => void;
  /**
   * Launch. Pass a folder to use and save that one (the Settings field);
   * pass nothing to reuse whatever main already saved (the sidebar row).
   * Resolves to an already-translated error sentence, or null on success.
   */
  launch: (projectPath?: string) => Promise<string | null>;
}

export function useClaudeLauncher(): ClaudeLauncherApi {
  const { t } = useTranslation();
  // Read once per mount: the bridge is a frozen object the preload installed
  // before any React ran, so re-resolving it every render buys nothing.
  const bridge = useMemo(() => getClaudeLauncherBridge(), []);
  const [projectPath, setProjectPath] = useState("");

  useEffect(() => {
    if (!bridge) return;
    let cancelled = false;
    void bridge.getClaudeProjectPath().then((saved) => {
      // Only seeds. A user who started typing while the read was in flight
      // keeps what they typed — the saved value is a convenience, not the
      // source of truth for a field they are already editing.
      if (!cancelled && saved) {
        setProjectPath((current) => (current === "" ? saved : current));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [bridge]);

  const launch = useCallback(
    async (path?: string): Promise<string | null> => {
      if (!bridge) return t("settings.ai.errorUnavailable");
      try {
        const outcome = await bridge.launchClaude(
          path === undefined ? {} : { projectPath: path },
        );
        if (outcome.ok) return null;
        /*
         * Spelled out here rather than through a code -> key table so every
         * key stays a literal `t("...")`: shared/tests/i18nKeys.test.ts scans
         * for those, and a table would put these sentences outside the only
         * check that catches a key missing from ja.json before a user sees the
         * raw key on screen. (web's `t` is typed to the catalog's key union
         * too, so a table would not even compile through a helper.)
         */
        switch (outcome.error) {
          case "no-project-path":
            return t("settings.ai.errorNoPath");
          case "invalid-project-path":
            return t("settings.ai.errorInvalidPath");
          case "claude-not-found":
            return t("settings.ai.errorNotFound");
          default:
            // `spawn-failed`, and any code a newer main names that this build
            // has no sentence for: "nothing was started" is true of all of
            // them, which is the part the user needs.
            return t("settings.ai.errorSpawnFailed");
        }
      } catch {
        // The invoke itself rejected: main has no handler for this channel,
        // which is what an older desktop shell running a newer renderer looks
        // like. Resolving with a sentence keeps the contract this hook
        // promises — the card never has to handle a rejection.
        return t("settings.ai.errorUnavailable");
      }
    },
    [bridge, t],
  );

  return {
    available: bridge !== null,
    projectPath,
    setProjectPath,
    launch,
  };
}

