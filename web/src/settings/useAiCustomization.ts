import { useCallback, useEffect, useState } from "react";
import {
  AiCustomizationValidationError,
  useSyncDomains,
  useTranslation,
  type AiCustomizationDataService,
  type AiCustomizationIssue,
  type AiMemory,
  type AiRule,
  type AiSkill,
  type AiSkillInput,
} from "@life-editor/shared";

/*
 * Host side of the Claude customization editor (#2119).
 *
 * Reads the three lists through the DataService (#2118) while the editor is
 * open, re-reads on the `aiCustomization` sync domain — so a memory Claude
 * added through MCP (#2121), or an edit on the other device, shows up without
 * reopening — and turns every write into the "translated sentence or null"
 * the shared editor expects (§6.4: copy belongs to the host).
 */

export interface AiCustomizationData {
  rule: AiRule | null;
  memories: AiMemory[];
  skills: AiSkill[];
}

export interface AiCustomizationApi {
  data: AiCustomizationData | null;
  loadError: string | null;
  saveRule: (body: string) => Promise<string | null>;
  createMemory: (body: string) => Promise<string | null>;
  updateMemory: (id: string, body: string) => Promise<string | null>;
  deleteMemory: (id: string) => Promise<string | null>;
  createSkill: (input: AiSkillInput) => Promise<string | null>;
  updateSkill: (
    id: string,
    updates: Partial<AiSkillInput>,
  ) => Promise<string | null>;
  deleteSkill: (id: string) => Promise<string | null>;
}

export function useAiCustomization(
  ds: AiCustomizationDataService | null,
  enabled: boolean,
): AiCustomizationApi {
  const { t } = useTranslation();
  const version = useSyncDomains("aiCustomization");
  const [data, setData] = useState<AiCustomizationData | null>(null);
  const [failed, setFailed] = useState(false);
  // Bumped after each successful write, so the list re-reads even where
  // Realtime is off (and before its echo arrives where it is on).
  const [local, setLocal] = useState(0);

  useEffect(() => {
    if (!enabled || !ds) return;
    let active = true;
    void Promise.all([
      ds.fetchAiRule(),
      ds.fetchAiMemories(),
      ds.fetchAiSkills(),
    ])
      .then(([rule, memories, skills]) => {
        if (!active) return;
        setData({ rule, memories, skills });
        setFailed(false);
      })
      .catch((e: unknown) => {
        console.error("[settings] ai customization read", e);
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [ds, enabled, version, local]);

  const issueText = useCallback(
    (issue: AiCustomizationIssue): string => {
      switch (issue) {
        case "empty":
          return t("settings.aiCustomization.issue.empty");
        case "tooLong":
          return t("settings.aiCustomization.issue.tooLong");
        case "multiline":
          return t("settings.aiCustomization.issue.multiline");
        case "badSlug":
          return t("settings.aiCustomization.issue.badSlug");
        case "taken":
          return t("settings.aiCustomization.issue.taken");
      }
    },
    [t],
  );

  const write = useCallback(
    async (run: (service: AiCustomizationDataService) => Promise<unknown>) => {
      if (!ds) return t("settings.aiCustomization.saveFailed");
      try {
        await run(ds);
        setLocal((n) => n + 1);
        return null;
      } catch (e: unknown) {
        if (e instanceof AiCustomizationValidationError)
          return issueText(e.issue);
        console.error("[settings] ai customization write", e);
        return t("settings.aiCustomization.saveFailed");
      }
    },
    [ds, issueText, t],
  );

  return {
    data: ds ? data : null,
    loadError: !ds || failed ? t("settings.aiCustomization.loadFailed") : null,
    saveRule: (body) => write((s) => s.saveAiRule(body)),
    createMemory: (body) => write((s) => s.createAiMemory(body)),
    updateMemory: (id, body) => write((s) => s.updateAiMemory(id, body)),
    deleteMemory: (id) => write((s) => s.deleteAiMemory(id)),
    createSkill: (input) => write((s) => s.createAiSkill(input)),
    updateSkill: (id, updates) => write((s) => s.updateAiSkill(id, updates)),
    deleteSkill: (id) => write((s) => s.deleteAiSkill(id)),
  };
}
