import { useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import { SectionTabs, type TabItem } from "../shared/SectionTabs";
import { MemoTab } from "./MemoTab";
import { EditorTab } from "./EditorTab";
import { Section, Strong } from "./shared";

const SUB_TABS = [
  { id: "daily", labelKey: "tips.memo" },
  { id: "notes", labelKey: "notes.title" },
  { id: "editor", labelKey: "tips.editor" },
] as const satisfies readonly TabItem[];

type SubTabId = (typeof SUB_TABS)[number]["id"];

export function MemoTipsTab() {
  const [subTab, setSubTab] = useState<SubTabId>("daily");
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <SectionTabs
        tabs={SUB_TABS}
        activeTab={subTab}
        onTabChange={setSubTab}
        size="sm"
      />
      {subTab === "daily" && <MemoTab />}
      {subTab === "notes" && <NotesTipsContent />}
      {subTab === "editor" && (
        <div className="space-y-6">
          <EditorTab />
          <p className="text-xs text-notion-text-secondary italic">
            {t("tips.editorTab.sharedUsageNote")}
          </p>
        </div>
      )}
    </div>
  );
}

function NotesTipsContent() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 text-sm text-notion-text-secondary">
      <Section title={t("tips.memoTab.notes")}>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <Trans
              i18nKey="tips.memoTab.notesList1"
              components={{ strong: <Strong /> }}
            />
          </li>
          <li>{t("tips.memoTab.notesList2")}</li>
          <li>
            <Trans
              i18nKey="tips.memoTab.notesList3"
              components={{ strong: <Strong /> }}
            />
          </li>
        </ul>
      </Section>
    </div>
  );
}
