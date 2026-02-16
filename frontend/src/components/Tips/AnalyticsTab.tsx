import { useTranslation, Trans } from "react-i18next";
import { Section, Strong, Kbd } from "./shared";

interface AnalyticsTabProps {
  showMac: boolean;
}

export function AnalyticsTab({ showMac }: AnalyticsTabProps) {
  const { t } = useTranslation();
  const mod = showMac ? "⌘" : "Ctrl";

  return (
    <div className="space-y-6 text-sm text-notion-text-secondary">
      <Section title={t("tips.analyticsTab.overview")}>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>{t("tips.analyticsTab.overviewList1")}</li>
          <li>
            <Trans
              i18nKey="tips.analyticsTab.overviewList2"
              components={{ strong: <Strong /> }}
            />
          </li>
          <li>{t("tips.analyticsTab.overviewList3")}</li>
        </ul>
      </Section>

      <Section title={t("tips.analyticsTab.completion")}>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <Trans
              i18nKey="tips.analyticsTab.completionList1"
              components={{ strong: <Strong /> }}
            />
          </li>
          <li>
            <Trans
              i18nKey="tips.analyticsTab.completionList2"
              components={{ strong: <Strong /> }}
            />
          </li>
          <li>{t("tips.analyticsTab.completionList3")}</li>
        </ul>
      </Section>

      <Section title={t("tips.analyticsTab.workTime")}>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <Trans
              i18nKey="tips.analyticsTab.workTimeList1"
              components={{ strong: <Strong /> }}
            />
          </li>
          <li>
            <Trans
              i18nKey="tips.analyticsTab.workTimeList2"
              components={{ strong: <Strong /> }}
            />
          </li>
          <li>{t("tips.analyticsTab.workTimeList3")}</li>
        </ul>
      </Section>

      <Section title={t("tips.analyticsTab.accessing")}>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <Trans
              i18nKey="tips.analyticsTab.accessingList1"
              values={{ mod }}
              components={{ kbd: <Kbd /> }}
            />
          </li>
          <li>
            <Trans
              i18nKey="tips.analyticsTab.accessingList2"
              components={{ strong: <Strong /> }}
            />
          </li>
          <li>
            <Trans
              i18nKey="tips.analyticsTab.accessingList3"
              values={{ mod }}
              components={{ kbd: <Kbd /> }}
            />
          </li>
        </ul>
      </Section>
    </div>
  );
}
