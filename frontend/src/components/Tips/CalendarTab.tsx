import { useTranslation, Trans } from "react-i18next";
import { Section, Strong, Kbd } from "./shared";

export function CalendarTab() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 text-sm text-notion-text-secondary">
      <Section title={t("tips.calendarTab.views")}>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <Trans
              i18nKey="tips.calendarTab.viewsList1"
              components={{ strong: <Strong /> }}
            />
          </li>
          <li>{t("tips.calendarTab.viewsList2")}</li>
          <li>
            <Trans
              i18nKey="tips.calendarTab.viewsList3"
              components={{ strong: <Strong /> }}
            />
          </li>
        </ul>
      </Section>

      <Section title={t("tips.calendarTab.creating")}>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>{t("tips.calendarTab.creatingList1")}</li>
          <li>{t("tips.calendarTab.creatingList2")}</li>
        </ul>
      </Section>

      <Section title={t("tips.calendarTab.display")}>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <Trans
              i18nKey="tips.calendarTab.displayList1"
              components={{ strong: <Strong /> }}
            />
          </li>
          <li>{t("tips.calendarTab.displayList2")}</li>
          <li>{t("tips.calendarTab.displayList3")}</li>
        </ul>
      </Section>

      <Section title={t("tips.calendarTab.weekView")}>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>{t("tips.calendarTab.weekViewList1")}</li>
          <li>{t("tips.calendarTab.weekViewList2")}</li>
          <li>{t("tips.calendarTab.weekViewList3")}</li>
        </ul>
      </Section>

      <Section title={t("tips.calendarTab.filtering")}>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>{t("tips.calendarTab.filteringList1")}</li>
          <li>{t("tips.calendarTab.filteringList2")}</li>
        </ul>
      </Section>

      <Section title={t("tips.calendarTab.dayView")}>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>{t("tips.calendarTab.dayViewList1")}</li>
          <li>
            <Trans
              i18nKey="tips.calendarTab.dayViewList2"
              components={{ strong: <Strong /> }}
            />
          </li>
          <li>
            <Trans
              i18nKey="tips.calendarTab.dayViewList3"
              components={{ strong: <Strong /> }}
            />
          </li>
        </ul>
      </Section>

      <Section title={t("tips.calendarTab.routines")}>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <Trans
              i18nKey="tips.calendarTab.routinesList1"
              components={{ strong: <Strong /> }}
            />
          </li>
          <li>{t("tips.calendarTab.routinesList2")}</li>
          <li>{t("tips.calendarTab.routinesList3")}</li>
        </ul>
      </Section>

      <Section title={t("tips.calendarTab.shortcuts")}>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <Trans
              i18nKey="tips.calendarTab.shortcutsList1"
              components={{ kbd: <Kbd /> }}
            />
          </li>
          <li>
            <Trans
              i18nKey="tips.calendarTab.shortcutsList2"
              components={{ kbd: <Kbd /> }}
            />
          </li>
          <li>
            <Trans
              i18nKey="tips.calendarTab.shortcutsList3"
              components={{ kbd: <Kbd /> }}
            />
          </li>
          <li>
            <Trans
              i18nKey="tips.calendarTab.shortcutsList4"
              components={{ kbd: <Kbd /> }}
            />
          </li>
        </ul>
      </Section>
    </div>
  );
}
