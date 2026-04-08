import { useTranslation } from "react-i18next";
import { SortDropdown as GenericSortDropdown } from "../../shared/SortDropdown";
import type { SortMode } from "../../../utils/sortTaskNodes";

const SORT_OPTIONS: readonly SortMode[] = [
  "manual",
  "status",
  "scheduledAt",
  "priority",
];

interface TaskTreeSortDropdownProps {
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
}

export function SortDropdown({
  sortMode,
  onSortChange,
}: TaskTreeSortDropdownProps) {
  const { t } = useTranslation();

  const labelMap: Record<SortMode, string> = {
    manual: t("taskTree.sortManual"),
    status: t("taskTree.sortStatus"),
    scheduledAt: t("taskTree.sortSchedule"),
    priority: t("taskTree.sortPriority"),
  };

  return (
    <GenericSortDropdown
      sortMode={sortMode}
      onSortChange={onSortChange}
      options={SORT_OPTIONS}
      labelMap={labelMap}
      defaultMode="manual"
      title={t("taskTree.sort")}
    />
  );
}
