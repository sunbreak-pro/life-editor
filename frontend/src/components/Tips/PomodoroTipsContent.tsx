import { useTranslation, Trans } from "react-i18next";
import { Section, Strong } from "./shared";

export function PomodoroTipsContent() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 text-sm text-notion-text-secondary">
      <Section title={t("tips.pomodoroTab.settings")}>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <Trans
              i18nKey="tips.pomodoroTab.settingsList1"
              components={{ strong: <Strong /> }}
            />
          </li>
          <li>{t("tips.pomodoroTab.settingsList2")}</li>
          <li>{t("tips.pomodoroTab.settingsList3")}</li>
          <li>{t("tips.pomodoroTab.settingsList4")}</li>
        </ul>
      </Section>

      <Section title={t("tips.pomodoroTab.presets")}>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>{t("tips.pomodoroTab.presetsList1")}</li>
          <li>{t("tips.pomodoroTab.presetsList2")}</li>
          <li>{t("tips.pomodoroTab.presetsList3")}</li>
        </ul>
      </Section>

      <Section title={t("tips.pomodoroTab.autoStart")}>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>{t("tips.pomodoroTab.autoStartList1")}</li>
          <li>{t("tips.pomodoroTab.autoStartList2")}</li>
        </ul>
      </Section>
    </div>
  );
}
