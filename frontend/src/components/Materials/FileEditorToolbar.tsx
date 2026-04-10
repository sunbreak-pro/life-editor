import { ExternalLink, Save, X, FileText, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatFileSize } from "./fileIcons";
import type { FileInfo } from "../../types/fileExplorer";

interface FileEditorToolbarProps {
  fileInfo: FileInfo;
  isDirty: boolean;
  onSave: () => void;
  onClose: () => void;
  onOpenInSystem: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function FileEditorToolbar({
  fileInfo,
  isDirty,
  onSave,
  onClose,
  onOpenInSystem,
}: FileEditorToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-notion-border">
      <FileText className="w-4 h-4 text-notion-secondary shrink-0" />
      <span className="text-sm font-medium text-notion-text truncate">
        {fileInfo.name}
      </span>
      {isDirty && (
        <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
      )}

      {/* File info */}
      <div className="hidden sm:flex items-center gap-3 ml-2 text-xs text-notion-secondary">
        <span>{formatFileSize(fileInfo.size)}</span>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {formatDate(fileInfo.modifiedAt)}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <button
          className="p-1.5 rounded hover:bg-notion-hover text-notion-secondary"
          onClick={onOpenInSystem}
          title={t("files.openInSystem")}
        >
          <ExternalLink className="w-4 h-4" />
        </button>
        {isDirty && (
          <button
            className="p-1.5 rounded hover:bg-notion-hover text-notion-secondary"
            onClick={onSave}
            title={t("files.save")}
          >
            <Save className="w-4 h-4" />
          </button>
        )}
        <button
          className="p-1.5 rounded hover:bg-notion-hover text-notion-secondary"
          onClick={onClose}
          title={t("files.close")}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
