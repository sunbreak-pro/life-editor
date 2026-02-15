import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { RoutineNode } from "../../types/routine";

interface RoutineStackDialogProps {
  routines: RoutineNode[];
  onSubmit: (name: string, routineIds: string[]) => void;
  onClose: () => void;
}

export function RoutineStackDialog({
  routines,
  onSubmit,
  onClose,
}: RoutineStackDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleRoutine = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSubmit = () => {
    if (!name.trim() || selectedIds.length < 2) return;
    onSubmit(name.trim(), selectedIds);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-notion-bg border border-notion-border rounded-xl shadow-2xl p-5 w-80 max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-notion-text mb-4">
          {t("routine.createStack")}
        </h3>

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("routine.stackNamePlaceholder")}
          className="w-full px-3 py-2 text-sm bg-transparent border border-notion-border rounded-lg outline-none focus:border-notion-accent text-notion-text placeholder:text-notion-text-secondary mb-3"
          autoFocus
        />

        <label className="text-xs text-notion-text-secondary mb-1.5 block">
          {t("routine.selectRoutines")}
        </label>
        <div className="flex-1 overflow-y-auto space-y-1 mb-3">
          {routines.map((r) => {
            const selected = selectedIds.includes(r.id);
            const order = selected ? selectedIds.indexOf(r.id) + 1 : null;
            return (
              <button
                key={r.id}
                onClick={() => toggleRoutine(r.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-colors ${
                  selected
                    ? "bg-notion-accent/10 text-notion-accent border border-notion-accent/30"
                    : "text-notion-text border border-notion-border hover:bg-notion-hover"
                }`}
              >
                <span className="w-5 h-5 rounded-md border flex items-center justify-center shrink-0">
                  {selected ? (
                    <span className="text-[10px] font-bold">{order}</span>
                  ) : null}
                </span>
                <span className="truncate">{r.title}</span>
              </button>
            );
          })}
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-notion-text-secondary hover:bg-notion-hover rounded-lg transition-colors"
          >
            {t("routine.cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || selectedIds.length < 2}
            className="px-3 py-1.5 text-xs bg-notion-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {t("routine.create")}
          </button>
        </div>
      </div>
    </div>
  );
}
