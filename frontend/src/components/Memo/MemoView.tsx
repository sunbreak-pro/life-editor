import { useState } from "react";
import { BookOpen, StickyNote } from "lucide-react";
import { useTranslation } from "react-i18next";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import { DailyMemoView } from "./DailyMemoView";
import { NotesView } from "./NotesView";

type MemoTab = "daily" | "notes";

function getInitialTab(): MemoTab {
  const saved = localStorage.getItem(STORAGE_KEYS.MEMO_TAB);
  if (saved === "notes") return saved;
  // Migrate old "routine" tab selection to "daily"
  return "daily";
}

export function MemoView() {
  const [activeTab, setActiveTab] = useState<MemoTab>(getInitialTab);
  const { t } = useTranslation();

  const handleTabChange = (tab: MemoTab) => {
    setActiveTab(tab);
    localStorage.setItem(STORAGE_KEYS.MEMO_TAB, tab);
  };

  return (
    <div className="min-h-170 max-h-fit flex flex-col">
      <div className="flex border-b border-notion-border shrink-0">
        <button
          onClick={() => handleTabChange("daily")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
            activeTab === "daily"
              ? "border-notion-primary text-notion-text"
              : "border-transparent text-notion-text-secondary hover:text-notion-text"
          }`}
        >
          <BookOpen size={15} />
          {t("memo.daily")}
        </button>
        <button
          onClick={() => handleTabChange("notes")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
            activeTab === "notes"
              ? "border-notion-primary text-notion-text"
              : "border-transparent text-notion-text-secondary hover:text-notion-text"
          }`}
        >
          <StickyNote size={15} />
          {t("memo.notes")}
        </button>
      </div>

      <div className="flex-1 min-h-0">
        {activeTab === "daily" && <DailyMemoView />}
        {activeTab === "notes" && <NotesView />}
      </div>
    </div>
  );
}
