import { useState, useCallback, useEffect, useRef } from "react";
import {
  FileText,
  Plus,
  Trash2,
  Star,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  Pencil,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { useTemplateContext } from "../../hooks/useTemplateContext";
import { EditableTitle } from "../shared/EditableTitle";
import type { Template } from "../../types/template";

interface TemplateManagerProps {
  entityType: "note" | "daily";
}

export function TemplateManager({ entityType }: TemplateManagerProps) {
  const { t } = useTranslation();
  const {
    templates,
    defaultNoteTemplateId,
    defaultDailyTemplateId,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    setDefaultNoteTemplate,
    setDefaultDailyTemplate,
  } = useTemplateContext();

  const [isOpen, setIsOpen] = useState(false);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingContentId, setEditingContentId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const defaultId =
    entityType === "note" ? defaultNoteTemplateId : defaultDailyTemplateId;
  const setDefault =
    entityType === "note" ? setDefaultNoteTemplate : setDefaultDailyTemplate;

  const handleCreate = useCallback(() => {
    createTemplate(t("templates.untitled"));
  }, [createTemplate, t]);

  const handleToggleDefault = useCallback(
    (id: string) => {
      if (defaultId === id) {
        setDefault(null);
      } else {
        setDefault(id);
      }
    },
    [defaultId, setDefault],
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteTemplate(id);
      setConfirmDeleteId(null);
      if (editingContentId === id) {
        setEditingContentId(null);
      }
    },
    [deleteTemplate, editingContentId],
  );

  const handleSaveContent = useCallback(
    (id: string, content: string) => {
      updateTemplate(id, { content });
    },
    [updateTemplate],
  );

  const editingTemplate = editingContentId
    ? templates.find((t) => t.id === editingContentId)
    : null;

  if (editingTemplate) {
    return (
      <div className="border-t border-notion-border">
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-notion-border">
          <button
            onClick={() => setEditingContentId(null)}
            className="p-0.5 rounded hover:bg-notion-hover text-notion-text-secondary"
          >
            <ArrowLeft size={14} />
          </button>
          <span className="text-xs font-medium text-notion-text truncate">
            {editingTemplate.name}
          </span>
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          <TemplateEditor
            key={editingTemplate.id}
            content={editingTemplate.content}
            onChange={(content) =>
              handleSaveContent(editingTemplate.id, content)
            }
            placeholder={t("templates.editContent")}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-notion-border">
      <div className="flex items-center justify-between px-3 py-2 hover:bg-notion-hover transition-colors">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 text-xs font-semibold text-notion-text-secondary uppercase tracking-wider"
        >
          {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          <FileText size={13} />
          <span>{t("templates.title")}</span>
        </button>
        {isOpen && (
          <button
            onClick={handleCreate}
            className="p-1 rounded hover:bg-notion-hover-strong text-notion-text-secondary hover:text-notion-success"
          >
            <Plus size={14} />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="px-1 pb-2">
          {templates.length === 0 ? (
            <div className="px-3 py-2 text-xs text-notion-text-secondary">
              {t("templates.empty")}
            </div>
          ) : (
            templates.map((tmpl) => (
              <TemplateItem
                key={tmpl.id}
                template={tmpl}
                isDefault={defaultId === tmpl.id}
                isEditingName={editingNameId === tmpl.id}
                isConfirmingDelete={confirmDeleteId === tmpl.id}
                onToggleDefault={() => handleToggleDefault(tmpl.id)}
                onStartEditName={() => setEditingNameId(tmpl.id)}
                onSaveName={(name) => {
                  updateTemplate(tmpl.id, { name });
                  setEditingNameId(null);
                }}
                onCancelEditName={() => setEditingNameId(null)}
                onEditContent={() => setEditingContentId(tmpl.id)}
                onRequestDelete={() => setConfirmDeleteId(tmpl.id)}
                onConfirmDelete={() => handleDelete(tmpl.id)}
                onCancelDelete={() => setConfirmDeleteId(null)}
                defaultLabel={
                  entityType === "note"
                    ? t("templates.defaultNote")
                    : t("templates.defaultDaily")
                }
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface TemplateItemProps {
  template: Template;
  isDefault: boolean;
  isEditingName: boolean;
  isConfirmingDelete: boolean;
  onToggleDefault: () => void;
  onStartEditName: () => void;
  onSaveName: (name: string) => void;
  onCancelEditName: () => void;
  onEditContent: () => void;
  onRequestDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  defaultLabel: string;
}

function TemplateEditor({
  content,
  onChange,
  placeholder,
}: {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}) {
  const debounceRef = useRef<number | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder: placeholder ?? "",
      }),
    ],
    content: content
      ? (() => {
          try {
            return JSON.parse(content);
          } catch {
            return content;
          }
        })()
      : undefined,
    onUpdate: ({ editor: ed }) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        const json = JSON.stringify(ed.getJSON());
        onChange(json);
      }, 500);
    },
  });

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  if (!editor) return null;

  return (
    <div className="px-3 py-2 prose prose-sm max-w-none text-notion-text [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[80px]">
      <EditorContent editor={editor} />
    </div>
  );
}

function TemplateItem({
  template,
  isDefault,
  isEditingName,
  isConfirmingDelete,
  onToggleDefault,
  onStartEditName,
  onSaveName,
  onCancelEditName,
  onEditContent,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
  defaultLabel,
}: TemplateItemProps) {
  const { t } = useTranslation();

  if (isConfirmingDelete) {
    return (
      <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-red-500/10">
        <span className="text-xs text-red-400 flex-1 truncate">
          {isDefault
            ? t("templates.deleteDefaultWarning")
            : t("templates.deleteConfirm")}
        </span>
        <button
          onClick={onConfirmDelete}
          className="px-1.5 py-0.5 text-[11px] rounded bg-red-500 text-white hover:bg-red-600"
        >
          {t("templates.delete")}
        </button>
        <button
          onClick={onCancelDelete}
          className="px-1.5 py-0.5 text-[11px] rounded bg-notion-hover text-notion-text-secondary hover:bg-notion-hover-strong"
        >
          {t("common.cancel")}
        </button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-1 px-2 py-1 rounded-md hover:bg-notion-hover text-[13px]">
      <button
        onClick={onToggleDefault}
        className={`shrink-0 p-0.5 rounded ${
          isDefault
            ? "text-yellow-500"
            : "text-notion-text-secondary opacity-0 group-hover:opacity-100"
        }`}
        title={isDefault ? t("templates.removeDefault") : defaultLabel}
      >
        <Star size={12} fill={isDefault ? "currentColor" : "none"} />
      </button>

      {isEditingName ? (
        <EditableTitle
          value={template.name}
          onSave={onSaveName}
          onCancel={onCancelEditName}
          checkComposing
          className="flex-1 min-w-0 bg-transparent border-b border-notion-border outline-none text-[13px] text-notion-text px-0.5"
        />
      ) : (
        <span
          className="truncate flex-1 min-w-0 text-notion-text cursor-pointer"
          onDoubleClick={onStartEditName}
        >
          {template.name}
        </span>
      )}

      {!isEditingName && (
        <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
          <button
            onClick={onStartEditName}
            className="p-0.5 rounded hover:bg-notion-hover-strong text-notion-text-secondary"
            title={t("templates.rename")}
          >
            <Pencil size={11} />
          </button>
          <button
            onClick={onEditContent}
            className="p-0.5 rounded hover:bg-notion-hover-strong text-notion-text-secondary"
            title={t("templates.editContent")}
          >
            <FileText size={11} />
          </button>
          <button
            onClick={onRequestDelete}
            className="p-0.5 rounded hover:bg-notion-hover-strong text-notion-text-secondary hover:text-red-400"
            title={t("templates.delete")}
          >
            <Trash2 size={11} />
          </button>
        </div>
      )}
    </div>
  );
}
