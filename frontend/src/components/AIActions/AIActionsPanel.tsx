import { useCallback, useMemo } from "react";
import {
  ListChecks,
  CalendarCheck,
  CalendarPlus,
  FileText,
  Sparkles,
  Tags,
  BookOpen,
  FileUp,
  Sun,
  Wand2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SectionId } from "../../types/taskTree";
import type { AIAction } from "../../types/aiActions";
import { AI_ACTIONS } from "../../constants/aiActions";
import { useNoteContext } from "../../hooks/useNoteContext";
import { useMemoContext } from "../../hooks/useMemoContext";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import type { LayoutHandle } from "../Layout/Layout";

const ICON_MAP: Record<string, typeof ListChecks> = {
  ListChecks,
  CalendarCheck,
  CalendarPlus,
  FileText,
  Sparkles,
  Tags,
  BookOpen,
  FileUp,
  Sun,
  Wand2,
};

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function resolvePrompt(
  template: string,
  context: {
    noteId: string | null;
    memoDate: string | null;
    today: string;
    tomorrow: string;
  },
): string {
  return template
    .replace(/\{\{noteId\}\}/g, context.noteId ?? "")
    .replace(/\{\{memoDate\}\}/g, context.memoDate ?? "")
    .replace(/\{\{today\}\}/g, context.today)
    .replace(/\{\{tomorrow\}\}/g, context.tomorrow);
}

interface AIActionsPanelProps {
  activeSection: SectionId;
  layoutRef: React.RefObject<LayoutHandle | null>;
}

export function AIActionsPanel({
  activeSection,
  layoutRef,
}: AIActionsPanelProps) {
  const { t } = useTranslation();
  const { selectedNoteId } = useNoteContext();
  const { selectedDate } = useMemoContext();

  const ideasTab =
    activeSection === "ideas"
      ? (localStorage.getItem(STORAGE_KEYS.IDEAS_TAB) ?? "materials")
      : null;

  const today = formatDate(new Date());
  const tomorrow = formatDate(new Date(Date.now() + 24 * 60 * 60 * 1000));

  const filteredActions = useMemo(() => {
    return AI_ACTIONS.filter((action) => {
      // Global actions always show
      if (action.sections === "global") return true;

      // Section match
      if (!action.sections.includes(activeSection)) return false;

      // Ideas tab match
      if (action.ideasTab && action.ideasTab !== ideasTab) return false;

      // Context requirement check: hide if context is required but not available
      if (action.contextRequired === "note" && !selectedNoteId) return false;
      if (action.contextRequired === "memo" && !selectedDate) return false;

      return true;
    });
  }, [activeSection, ideasTab, selectedNoteId, selectedDate]);

  const handleAction = useCallback(
    (action: AIAction) => {
      const prompt = resolvePrompt(action.promptTemplate, {
        noteId: selectedNoteId,
        memoDate: selectedDate,
        today,
        tomorrow,
      });
      layoutRef.current?.sendTerminalCommand(prompt);
    },
    [layoutRef, selectedNoteId, selectedDate, today, tomorrow],
  );

  if (filteredActions.length === 0) return null;

  return (
    <div className="space-y-1">
      <div className="px-3 mb-1">
        <span className="text-scaling-xs text-notion-text-secondary font-medium flex items-center gap-1.5">
          <Wand2 size={12} />
          {t("aiActions.title")}
        </span>
      </div>
      {filteredActions.map((action) => {
        const Icon = ICON_MAP[action.icon] ?? Wand2;
        return (
          <button
            key={action.id}
            onClick={() => handleAction(action)}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-scaling-xs text-notion-text-secondary hover:bg-notion-hover/80 hover:text-notion-text transition-all duration-150 cursor-pointer"
          >
            <Icon size={14} className="shrink-0 opacity-70" />
            <span className="truncate">{t(action.labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
}
