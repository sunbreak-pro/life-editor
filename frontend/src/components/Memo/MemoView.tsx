import { DailyMemoView } from "./DailyMemoView";
import { NotesView } from "./NotesView";

type MemoTab = "daily" | "notes";

interface MemoViewProps {
  activeTab: MemoTab;
}

export function MemoView({ activeTab }: MemoViewProps) {
  return (
    <div className="min-h-170 max-h-fit flex flex-col">
      <div className="flex-1 min-h-0">
        {activeTab === "daily" && <DailyMemoView />}
        {activeTab === "notes" && <NotesView />}
      </div>
    </div>
  );
}
