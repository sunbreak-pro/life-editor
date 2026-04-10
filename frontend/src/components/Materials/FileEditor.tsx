import { useState, useEffect, useCallback } from "react";
import { FolderOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFileExplorerContext } from "../../hooks/useFileExplorerContext";
import { FileEditorToolbar } from "./FileEditorToolbar";
import {
  isTextFile,
  isImageFile,
  isAudioFile,
  isVideoFile,
  formatFileSize,
} from "./fileIcons";
import { getDataService } from "../../services/dataServiceFactory";

function TextEditor() {
  const {
    openFile,
    isDirty,
    updateFileContent,
    saveCurrentFile,
    closeFile,
    openInSystem,
  } = useFileExplorerContext();

  if (!openFile) return null;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Cmd/Ctrl+S to save
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        saveCurrentFile();
      }
    },
    [saveCurrentFile],
  );

  return (
    <div className="h-full flex flex-col">
      <FileEditorToolbar
        fileInfo={openFile.info}
        isDirty={isDirty}
        onSave={saveCurrentFile}
        onClose={closeFile}
        onOpenInSystem={() => openInSystem(openFile.path)}
      />
      <textarea
        className="flex-1 w-full p-4 bg-notion-bg text-notion-text text-sm font-mono resize-none focus:outline-none leading-relaxed"
        value={openFile.content}
        onChange={(e) => updateFileContent(e.target.value)}
        onKeyDown={handleKeyDown}
        spellCheck={false}
      />
    </div>
  );
}

function ImagePreview() {
  const { openFile, closeFile, openInSystem } = useFileExplorerContext();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!openFile) return;
    let revoked = false;
    const ds = getDataService();
    ds.readFile(openFile.path).then((data) => {
      if (revoked) return;
      const blob = new Blob([data]);
      setBlobUrl(URL.createObjectURL(blob));
    });
    return () => {
      revoked = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [openFile?.path]);

  if (!openFile) return null;

  return (
    <div className="h-full flex flex-col">
      <FileEditorToolbar
        fileInfo={openFile.info}
        isDirty={false}
        onSave={() => {}}
        onClose={closeFile}
        onOpenInSystem={() => openInSystem(openFile.path)}
      />
      <div className="flex-1 flex items-center justify-center p-4 overflow-auto bg-notion-hover/30">
        {blobUrl && (
          <img
            src={blobUrl}
            alt={openFile.info.name}
            className="max-w-full max-h-full object-contain rounded shadow-sm"
          />
        )}
      </div>
    </div>
  );
}

function MediaPreview({ type }: { type: "audio" | "video" }) {
  const { openFile, closeFile, openInSystem } = useFileExplorerContext();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!openFile) return;
    let revoked = false;
    const ds = getDataService();
    ds.readFile(openFile.path).then((data) => {
      if (revoked) return;
      const blob = new Blob([data], { type: openFile.info.mimeType });
      setBlobUrl(URL.createObjectURL(blob));
    });
    return () => {
      revoked = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [openFile?.path]);

  if (!openFile) return null;

  return (
    <div className="h-full flex flex-col">
      <FileEditorToolbar
        fileInfo={openFile.info}
        isDirty={false}
        onSave={() => {}}
        onClose={closeFile}
        onOpenInSystem={() => openInSystem(openFile.path)}
      />
      <div className="flex-1 flex items-center justify-center p-8">
        {blobUrl && type === "audio" && (
          <audio controls src={blobUrl} className="w-full max-w-md" />
        )}
        {blobUrl && type === "video" && (
          <video
            controls
            src={blobUrl}
            className="max-w-full max-h-full rounded"
          />
        )}
      </div>
    </div>
  );
}

function UnsupportedFile() {
  const { t } = useTranslation();
  const { openFile, closeFile, openInSystem } = useFileExplorerContext();

  if (!openFile) return null;

  return (
    <div className="h-full flex flex-col">
      <FileEditorToolbar
        fileInfo={openFile.info}
        isDirty={false}
        onSave={() => {}}
        onClose={closeFile}
        onOpenInSystem={() => openInSystem(openFile.path)}
      />
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-notion-secondary">
        <FolderOpen className="w-16 h-16" />
        <p className="text-sm font-medium">{openFile.info.name}</p>
        <p className="text-xs">{formatFileSize(openFile.info.size)}</p>
        <button
          className="px-4 py-2 text-sm bg-notion-primary text-white rounded-md hover:opacity-90"
          onClick={() => openInSystem(openFile.path)}
        >
          {t("files.openInSystem")}
        </button>
      </div>
    </div>
  );
}

export function FileEditor() {
  const { openFile } = useFileExplorerContext();

  if (!openFile) return null;

  const ext = openFile.info.extension.toLowerCase();

  if (isTextFile(ext)) return <TextEditor />;
  if (isImageFile(ext)) return <ImagePreview />;
  if (isAudioFile(ext)) return <MediaPreview type="audio" />;
  if (isVideoFile(ext)) return <MediaPreview type="video" />;

  return <UnsupportedFile />;
}
