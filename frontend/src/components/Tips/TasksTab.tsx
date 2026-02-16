import { useTranslation, Trans } from "react-i18next";
import { Section, Strong, Kbd } from "./shared";

interface TasksTabProps {
  showMac: boolean;
}

export function TasksTab({ showMac }: TasksTabProps) {
  const { t } = useTranslation();
  const mod = showMac ? "⌘" : "Ctrl";
  const shift = showMac ? "⇧" : "Shift";

  return (
    <div className="space-y-6 text-sm text-notion-text-secondary">
      <Section title={t("tips.tasksTab.creating")}>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <Trans
              i18nKey="tips.tasksTab.creatingList1"
              components={{ strong: <Strong /> }}
            />
          </li>
          <li>
            <Trans
              i18nKey="tips.tasksTab.creatingList2"
              components={{ kbd: <Kbd /> }}
            />
          </li>
          <li>{t("tips.tasksTab.creatingList3")}</li>
        </ul>
      </Section>

      <Section title={t("tips.tasksTab.organizing")}>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <Trans
              i18nKey="tips.tasksTab.organizingList1"
              components={{ strong: <Strong /> }}
            />
          </li>
          <li>
            <Trans
              i18nKey="tips.tasksTab.organizingList2"
              components={{ strong: <Strong /> }}
            />
          </li>
          <li>{t("tips.tasksTab.organizingList3")}</li>
        </ul>
      </Section>

      <Section title={t("tips.tasksTab.details")}>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>{t("tips.tasksTab.detailsList1")}</li>
          <li>{t("tips.tasksTab.detailsList2")}</li>
          <li>
            <Trans
              i18nKey="tips.tasksTab.detailsList3"
              components={{ strong: <Strong /> }}
            />
          </li>
          <li>
            <Trans
              i18nKey="tips.tasksTab.detailsList4"
              values={{ mod, shift }}
              components={{ kbd: <Kbd /> }}
            />
          </li>
          <li>
            <Trans
              i18nKey="tips.tasksTab.detailsList5"
              values={{ mod, shift }}
              components={{ kbd: <Kbd /> }}
            />
          </li>
        </ul>
      </Section>

      <Section title={t("tips.tasksTab.folders")}>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>{t("tips.tasksTab.foldersList1")}</li>
          <li>{t("tips.tasksTab.foldersList2")}</li>
        </ul>
      </Section>

      <Section title={t("tips.tasksTab.softDelete")}>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>{t("tips.tasksTab.softDeleteList1")}</li>
          <li>
            <Trans
              i18nKey="tips.tasksTab.softDeleteList2"
              components={{ strong: <Strong /> }}
            />
          </li>
        </ul>
      </Section>

      <Section title={t("tips.tasksTab.contextMenu")}>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>{t("tips.tasksTab.contextMenuList1")}</li>
          <li>
            <Trans
              i18nKey="tips.tasksTab.contextMenuList2"
              components={{ strong: <Strong /> }}
            />
          </li>
          <li>
            <Trans
              i18nKey="tips.tasksTab.contextMenuList3"
              components={{ strong: <Strong /> }}
            />
          </li>
        </ul>
      </Section>

      <Section title={t("tips.tasksTab.tags")}>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <Trans
              i18nKey="tips.tasksTab.tagsList1"
              components={{ strong: <Strong /> }}
            />
          </li>
          <li>{t("tips.tasksTab.tagsList2")}</li>
          <li>{t("tips.tasksTab.tagsList3")}</li>
        </ul>
      </Section>

      <Section title={t("tips.tasksTab.templates")}>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <Trans
              i18nKey="tips.tasksTab.templatesList1"
              components={{ strong: <Strong /> }}
            />
          </li>
          <li>{t("tips.tasksTab.templatesList2")}</li>
          <li>{t("tips.tasksTab.templatesList3")}</li>
        </ul>
      </Section>
    </div>
  );
}
