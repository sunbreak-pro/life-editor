import { Suspense, useCallback } from "react";
import { FileText, Star, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTemplateContext } from "../../hooks/useTemplateContext";
import { formatDateTime } from "../../utils/formatRelativeDate";
import { LazyRichTextEditor as RichTextEditor } from "../shared/LazyRichTextEditor";

export function TemplateContentView() {
  const { t } = useTranslation();
  const {
    selectedTemplate,
    updateTemplate,
    deleteTemplate,
    setSelectedTemplateId,
    defaultNoteTemplateId,
    defaultDailyTemplateId,
    setDefaultNoteTemplate,
    setDefaultDailyTemplate,
  } = useTemplateContext();

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (selectedTemplate) {
        updateTemplate(selectedTemplate.id, { name: e.target.value });
      }
    },
    [selectedTemplate, updateTemplate],
  );

  const handleContentUpdate = useCallback(
    (content: string) => {
      if (selectedTemplate) {
        updateTemplate(selectedTemplate.id, { content });
      }
    },
    [selectedTemplate, updateTemplate],
  );

  const handleDelete = useCallback(() => {
    if (selectedTemplate) {
      deleteTemplate(selectedTemplate.id);
      setSelectedTemplateId(null);
    }
  }, [selectedTemplate, deleteTemplate, setSelectedTemplateId]);

  const isNoteDefault = selectedTemplate?.id === defaultNoteTemplateId;
  const isDailyDefault = selectedTemplate?.id === defaultDailyTemplateId;

  if (!selectedTemplate) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-notion-text-secondary">
        <FileText size={48} strokeWidth={1} className="mb-3 opacity-30" />
        <p className="text-sm">{t("templates.selectTemplate")}</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-8 py-6">
        {/* Title */}
        <div className="flex items-center gap-2 mb-4">
          <FileText size={16} className="shrink-0 text-notion-text-secondary" />
          <input
            type="text"
            value={selectedTemplate.name}
            onChange={handleTitleChange}
            placeholder={t("templates.untitled")}
            className="flex-1 text-lg font-semibold text-notion-text bg-transparent border-none outline-none placeholder:text-notion-text-secondary"
          />

          {/* Note default toggle */}
          <button
            onClick={() =>
              setDefaultNoteTemplate(isNoteDefault ? null : selectedTemplate.id)
            }
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
              isNoteDefault
                ? "bg-yellow-500/10 text-yellow-500"
                : "text-notion-text-secondary hover:bg-notion-hover"
            }`}
            title={
              isNoteDefault
                ? t("templates.removeDefault")
                : t("templates.defaultNote")
            }
          >
            <Star size={12} fill={isNoteDefault ? "currentColor" : "none"} />
            <span>{t("templates.defaultNoteShort")}</span>
          </button>

          {/* Daily default toggle */}
          <button
            onClick={() =>
              setDefaultDailyTemplate(
                isDailyDefault ? null : selectedTemplate.id,
              )
            }
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
              isDailyDefault
                ? "bg-yellow-500/10 text-yellow-500"
                : "text-notion-text-secondary hover:bg-notion-hover"
            }`}
            title={
              isDailyDefault
                ? t("templates.removeDefault")
                : t("templates.defaultDaily")
            }
          >
            <Star size={12} fill={isDailyDefault ? "currentColor" : "none"} />
            <span>{t("templates.defaultDailyShort")}</span>
          </button>

          {/* Delete */}
          <button
            onClick={handleDelete}
            className="p-1.5 rounded transition-colors text-notion-text-secondary hover:text-red-400 hover:bg-notion-hover"
            title={t("templates.delete")}
          >
            <Trash2 size={16} />
          </button>
        </div>

        {/* Date info */}
        <div className="flex items-center gap-3 text-[11px] text-notion-text-secondary/60 mb-3">
          {selectedTemplate.createdAt && (
            <span>
              {t("dateTime.created")}:{" "}
              {formatDateTime(selectedTemplate.createdAt)}
            </span>
          )}
          {selectedTemplate.updatedAt &&
            selectedTemplate.updatedAt !== selectedTemplate.createdAt && (
              <span>
                {t("dateTime.updated")}:{" "}
                {formatDateTime(selectedTemplate.updatedAt)}
              </span>
            )}
        </div>

        {/* Editor */}
        <Suspense
          fallback={
            <div className="text-notion-text-secondary text-sm">
              {t("dateTime.loadingEditor")}
            </div>
          }
        >
          <RichTextEditor
            taskId={selectedTemplate.id}
            initialContent={selectedTemplate.content}
            onUpdate={handleContentUpdate}
          />
        </Suspense>
      </div>
    </div>
  );
}
