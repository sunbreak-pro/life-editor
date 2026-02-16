import { useTranslation } from "react-i18next";
import { useTaskTreeContext } from "../../hooks/useTaskTreeContext";

export function TaskDetailEmpty() {
  const { t } = useTranslation();
  const { nodes } = useTaskTreeContext();

  const tasks = nodes.filter((n) => n.type === "task" && !n.isDeleted);
  const completed = tasks.filter((n) => n.status === "DONE");
  const incomplete = tasks.length - completed.length;

  return (
    <div className="h-full flex flex-col items-center justify-center text-notion-text-secondary">
      <p className="text-sm">{t("taskDetailPanel.selectTask")}</p>
      <div className="mt-3 text-xs space-y-1 text-center">
        <p>{t("taskDetailPanel.totalTasks", { count: tasks.length })}</p>
        <p>{t("taskDetailPanel.incomplete", { count: incomplete })}</p>
        <p>{t("taskDetailPanel.completed", { count: completed.length })}</p>
      </div>
    </div>
  );
}
