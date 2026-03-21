import type { AIAction } from "../types/aiActions";

export const AI_ACTIONS: AIAction[] = [
  // Global
  {
    id: "task-review",
    labelKey: "aiActions.taskReview",
    icon: "ListChecks",
    promptTemplate:
      "get_task_tree でタスク一覧を取得して、未完了タスクを分析してください。優先度の提案や整理の提案をお願いします。",
    sections: "global",
  },

  // Schedule
  {
    id: "organize-today",
    labelKey: "aiActions.organizeToday",
    icon: "CalendarCheck",
    promptTemplate:
      "list_schedule と list_tasks を使って今日（{{today}}）のスケジュールとタスクを取得し、最適化を提案してください。",
    sections: ["schedule"],
  },
  {
    id: "plan-tomorrow",
    labelKey: "aiActions.planTomorrow",
    icon: "CalendarPlus",
    promptTemplate:
      "list_tasks で未着手タスクを取得して、明日（{{tomorrow}}）のスケジュールを提案してください。",
    sections: ["schedule"],
  },

  // Ideas > Materials (Note selected)
  {
    id: "summarize-note",
    labelKey: "aiActions.summarizeNote",
    icon: "FileText",
    promptTemplate:
      "ノート（ID: {{noteId}}）の内容を取得して要約してください。",
    sections: ["ideas"],
    ideasTab: "materials",
    contextRequired: "note",
  },
  {
    id: "improve-note",
    labelKey: "aiActions.improveNote",
    icon: "Sparkles",
    promptTemplate:
      "ノート（ID: {{noteId}}）の内容を取得して、改善点を提案してください。",
    sections: ["ideas"],
    ideasTab: "materials",
    contextRequired: "note",
  },
  {
    id: "suggest-tags",
    labelKey: "aiActions.suggestTags",
    icon: "Tags",
    promptTemplate:
      "ノート（ID: {{noteId}}）の内容と list_wiki_tags の結果を照合して、適切なタグを提案してください。",
    sections: ["ideas"],
    ideasTab: "materials",
    contextRequired: "note",
  },

  // Ideas > Daily (Memo selected)
  {
    id: "review-memo",
    labelKey: "aiActions.reviewMemo",
    icon: "BookOpen",
    promptTemplate:
      "get_memo で {{memoDate}} のメモを取得して、振り返りと要約をしてください。",
    sections: ["ideas"],
    ideasTab: "daily",
    contextRequired: "memo",
  },
  {
    id: "promote-to-note",
    labelKey: "aiActions.promoteToNote",
    icon: "FileUp",
    promptTemplate:
      "get_memo で {{memoDate}} のメモを取得して、ノートに昇格させる形で整形してください。create_note で新しいノートを作成してください。",
    sections: ["ideas"],
    ideasTab: "daily",
    contextRequired: "memo",
  },

  // Ideas > Daily (general daily review)
  {
    id: "daily-review",
    labelKey: "aiActions.dailyReview",
    icon: "Sun",
    promptTemplate:
      "今日（{{today}}）の振り返りをしてください。get_memo, list_tasks, list_schedule を使って1日の活動を横断的にまとめてください。",
    sections: ["ideas"],
    ideasTab: "daily",
  },
];
