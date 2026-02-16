import { useState } from "react";
import { Plus, Trash2, Pencil, ChevronDown, ChevronRight } from "lucide-react";
import type { RoutineTemplate } from "../../types/schedule";
import type { RoutineNode } from "../../types/routine";
import { TemplateEditDialog } from "./TemplateEditDialog";

interface TemplateManagerProps {
  templates: RoutineTemplate[];
  routines: RoutineNode[];
  onCreateTemplate: (
    name: string,
    frequencyType: string,
    frequencyDays: number[],
  ) => void;
  onUpdateTemplate: (
    id: string,
    updates: Partial<
      Pick<RoutineTemplate, "name" | "frequencyType" | "frequencyDays">
    >,
  ) => void;
  onDeleteTemplate: (id: string) => void;
  onAddItem: (templateId: string, routineId: string) => void;
  onRemoveItem: (templateId: string, routineId: string) => void;
}

const FREQ_LABELS: Record<string, string> = {
  daily: "Daily",
  custom: "Custom",
};

const DAY_SHORT = ["S", "M", "T", "W", "T", "F", "S"];

export function TemplateManager({
  templates,
  routines,
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onAddItem,
  onRemoveItem,
}: TemplateManagerProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editDialog, setEditDialog] = useState<RoutineTemplate | "new" | null>(
    null,
  );

  const routineMap = new Map(routines.map((r) => [r.id, r]));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-notion-text-secondary uppercase tracking-wide font-medium">
          Templates
        </span>
        <button
          onClick={() => setEditDialog("new")}
          className="p-0.5 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
        >
          <Plus size={14} />
        </button>
      </div>

      {templates.length === 0 && (
        <p className="text-[10px] text-notion-text-secondary py-2">
          No templates yet
        </p>
      )}

      <div className="space-y-1">
        {templates.map((tmpl) => {
          const isExpanded = expandedId === tmpl.id;
          const assignedRoutineIds = new Set(
            tmpl.items.map((i) => i.routineId),
          );
          const availableRoutines = routines.filter(
            (r) => !r.isArchived && !assignedRoutineIds.has(r.id),
          );

          return (
            <div
              key={tmpl.id}
              className="border border-notion-border rounded-md overflow-hidden"
            >
              {/* Header */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : tmpl.id)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left hover:bg-notion-hover transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown
                    size={12}
                    className="text-notion-text-secondary"
                  />
                ) : (
                  <ChevronRight
                    size={12}
                    className="text-notion-text-secondary"
                  />
                )}
                <span className="flex-1 text-xs font-medium text-notion-text truncate">
                  {tmpl.name}
                </span>
                <span className="text-[10px] text-notion-text-secondary">
                  {FREQ_LABELS[tmpl.frequencyType] ?? tmpl.frequencyType}
                  {tmpl.frequencyType === "custom" &&
                    tmpl.frequencyDays.length > 0 && (
                      <span className="ml-1">
                        ({tmpl.frequencyDays.map((d) => DAY_SHORT[d]).join("")})
                      </span>
                    )}
                </span>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t border-notion-border px-2 py-1.5">
                  {/* Assigned routines */}
                  {tmpl.items.length > 0 && (
                    <div className="space-y-0.5 mb-1.5">
                      {tmpl.items
                        .sort((a, b) => {
                          const ra = routineMap.get(a.routineId);
                          const rb = routineMap.get(b.routineId);
                          return (ra?.startTime ?? "99:99").localeCompare(
                            rb?.startTime ?? "99:99",
                          );
                        })
                        .map((item) => {
                          const routine = routineMap.get(item.routineId);
                          return (
                            <div
                              key={item.routineId}
                              className="flex items-center gap-1.5 px-1.5 py-1 rounded border border-notion-border/60 hover:bg-notion-hover group"
                            >
                              <span className="flex-1 text-[11px] text-notion-text truncate">
                                {routine?.title ?? "Unknown"}
                              </span>
                              {routine?.startTime && (
                                <span className="text-[10px] text-notion-text-secondary">
                                  {routine.startTime}
                                </span>
                              )}
                              <button
                                onClick={() =>
                                  onRemoveItem(tmpl.id, item.routineId)
                                }
                                className="opacity-0 group-hover:opacity-100 p-0.5 text-notion-text-secondary hover:text-red-500 rounded transition-all"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          );
                        })}
                    </div>
                  )}

                  {/* Add routine dropdown */}
                  {availableRoutines.length > 0 && (
                    <div className="border-t border-notion-border/50 pt-1.5">
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            onAddItem(tmpl.id, e.target.value);
                            e.target.value = "";
                          }
                        }}
                        defaultValue=""
                        className="w-full px-1.5 py-1 text-[11px] bg-transparent border border-notion-border rounded text-notion-text-secondary"
                      >
                        <option value="">+ Add routine...</option>
                        {availableRoutines.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1 mt-1.5 pt-1 border-t border-notion-border/50">
                    <button
                      onClick={() => setEditDialog(tmpl)}
                      className="p-1 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => onDeleteTemplate(tmpl.id)}
                      className="p-1 text-notion-text-secondary hover:text-red-500 rounded transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editDialog && (
        <TemplateEditDialog
          template={editDialog === "new" ? undefined : editDialog}
          onSubmit={(name, frequencyType, frequencyDays) => {
            if (editDialog === "new") {
              onCreateTemplate(name, frequencyType, frequencyDays);
            } else {
              onUpdateTemplate(editDialog.id, {
                name,
                frequencyType,
                frequencyDays,
              });
            }
          }}
          onClose={() => setEditDialog(null)}
        />
      )}
    </div>
  );
}
