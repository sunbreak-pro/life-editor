import { useTranslation, Trans } from "react-i18next";
import { Section, Strong, Kbd } from "./shared";

export function MemoTab() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 text-sm text-notion-text-secondary">
      <Section title={t("tips.memoTab.daily")}>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>{t("tips.memoTab.dailyList1")}</li>
          <li>{t("tips.memoTab.dailyList2")}</li>
          <li>{t("tips.memoTab.dailyList3")}</li>
        </ul>
      </Section>

      <Section title={t("tips.memoTab.navigation")}>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>{t("tips.memoTab.navigationList1")}</li>
          <li>{t("tips.memoTab.navigationList2")}</li>
          <li>
            <Trans
              i18nKey="tips.memoTab.navigationList3"
              components={{ strong: <Strong /> }}
            />
          </li>
          <li>
            <Trans
              i18nKey="tips.memoTab.navigationList4"
              components={{ strong: <Strong /> }}
            />
          </li>
        </ul>
      </Section>

      <Section title={t("tips.memoTab.editor")}>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <Trans
              i18nKey="tips.memoTab.editorList1"
              components={{ strong: <Strong /> }}
            />
          </li>
          <li>
            <Trans
              i18nKey="tips.memoTab.editorList2"
              components={{ kbd: <Kbd /> }}
            />
          </li>
          <li>
            <Trans
              i18nKey="tips.memoTab.editorList3"
              components={{ strong: <Strong /> }}
            />
          </li>
        </ul>
      </Section>

      <Section title={t("tips.memoTab.calendarIntegration")}>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>{t("tips.memoTab.calendarIntegrationList1")}</li>
          <li>{t("tips.memoTab.calendarIntegrationList2")}</li>
        </ul>
      </Section>

      <Section title={t("tips.memoTab.deleting")}>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <Trans
              i18nKey="tips.memoTab.deletingList1"
              components={{ strong: <Strong /> }}
            />
          </li>
          <li>
            <Trans
              i18nKey="tips.memoTab.deletingList2"
              components={{ strong: <Strong /> }}
            />
          </li>
        </ul>
      </Section>
    </div>
  );
}
