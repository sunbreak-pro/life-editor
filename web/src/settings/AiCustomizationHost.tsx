import {
  SettingsAiCustomization,
  useTranslation,
  type AiCustomizationDataService,
} from "@life-editor/shared";
import { useAiCustomization } from "./useAiCustomization";

/*
 * The Claude customization editor as Settings mounts it (#2119). Its own
 * component so the reads, the sync-domain subscription and the copy exist
 * only while the editor is on screen — the AI card is what the category
 * shows the rest of the time.
 */
export function AiCustomizationHost({
  dataService,
  onBack,
}: {
  dataService: AiCustomizationDataService | null;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const ai = useAiCustomization(dataService, true);
  return (
    <SettingsAiCustomization
      data={ai.data}
      loadError={ai.loadError}
      onBack={onBack}
      onSaveRule={ai.saveRule}
      onCreateMemory={ai.createMemory}
      onUpdateMemory={ai.updateMemory}
      onDeleteMemory={ai.deleteMemory}
      onCreateSkill={ai.createSkill}
      onUpdateSkill={ai.updateSkill}
      onDeleteSkill={ai.deleteSkill}
      labels={{
        back: t("settings.aiCustomization.back"),
        heading: t("settings.aiCustomization.heading"),
        description: t("settings.aiCustomization.description"),
        tabsLabel: t("settings.aiCustomization.tabsLabel"),
        tabRules: t("settings.aiCustomization.tabRules"),
        tabMemories: t("settings.aiCustomization.tabMemories"),
        tabSkills: t("settings.aiCustomization.tabSkills"),
        loading: t("settings.aiCustomization.loading"),
        rulesDescription: t("settings.aiCustomization.rulesDescription"),
        rulesPlaceholder: t("settings.aiCustomization.rulesPlaceholder"),
        memoriesDescription: t(
          "settings.aiCustomization.memoriesDescription",
        ),
        memoriesEmpty: t("settings.aiCustomization.memoriesEmpty"),
        memoryPlaceholder: t("settings.aiCustomization.memoryPlaceholder"),
        addMemory: t("settings.aiCustomization.addMemory"),
        skillsDescription: t("settings.aiCustomization.skillsDescription"),
        skillsEmpty: t("settings.aiCustomization.skillsEmpty"),
        newSkill: t("settings.aiCustomization.newSkill"),
        skillSlug: t("settings.aiCustomization.skillSlug"),
        skillSlugHint: t("settings.aiCustomization.skillSlugHint"),
        skillDescription: t("settings.aiCustomization.skillDescription"),
        skillBody: t("settings.aiCustomization.skillBody"),
        skillBodyPlaceholder: t(
          "settings.aiCustomization.skillBodyPlaceholder",
        ),
        save: t("settings.aiCustomization.save"),
        saving: t("settings.aiCustomization.saving"),
        saved: t("settings.aiCustomization.saved"),
        cancel: t("settings.aiCustomization.cancel"),
        edit: t("settings.aiCustomization.edit"),
        delete: t("settings.aiCustomization.delete"),
        counter: (n, max) =>
          t("settings.aiCustomization.counter", { n, max }),
        confirmDeleteMemory: t(
          "settings.aiCustomization.confirmDeleteMemory",
        ),
        confirmDeleteSkill: (name) =>
          t("settings.aiCustomization.confirmDeleteSkill", { name }),
        issues: {
          empty: t("settings.aiCustomization.issue.empty"),
          tooLong: t("settings.aiCustomization.issue.tooLong"),
          multiline: t("settings.aiCustomization.issue.multiline"),
          badSlug: t("settings.aiCustomization.issue.badSlug"),
          taken: t("settings.aiCustomization.issue.taken"),
        },
      }}
    />
  );
}
