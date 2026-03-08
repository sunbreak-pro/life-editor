import { useState, useEffect, useCallback } from "react";
import { Save } from "lucide-react";
import { useTranslation } from "react-i18next";

export function ClaudeMdEditor() {
  const { t } = useTranslation();
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">(
    "idle",
  );

  useEffect(() => {
    window.electronAPI
      ?.invoke<string>("claude:readClaudeMd")
      .then((text) => {
        setContent(text);
        setSavedContent(text);
      })
      .catch(console.warn)
      .finally(() => setLoading(false));
  }, []);

  const isModified = content !== savedContent;

  const handleSave = useCallback(async () => {
    try {
      await window.electronAPI?.invoke("claude:writeClaudeMd", content);
      setSavedContent(content);
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }, [content]);

  // Ctrl/Cmd+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s" && isModified) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave, isModified]);

  if (loading) {
    return <div className="text-sm text-notion-text-secondary">Loading...</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-notion-text-secondary">
        {t("settings.claude.claudeMdDescription")}
      </p>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full h-80 p-3 text-sm font-mono bg-notion-bg border border-notion-border rounded-lg resize-y text-notion-text focus:outline-none focus:ring-1 focus:ring-notion-accent"
        spellCheck={false}
      />
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!isModified}
          className="flex items-center gap-2 px-4 py-2 bg-notion-accent text-white rounded-md text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Save size={14} />
          {t("settings.claude.save", "Save")}
        </button>
        {saveStatus === "success" && (
          <span className="text-sm text-green-500">
            {t("settings.claude.saveSuccess")}
          </span>
        )}
        {saveStatus === "error" && (
          <span className="text-sm text-red-500">
            {t("settings.claude.saveFailed")}
          </span>
        )}
        {isModified && saveStatus === "idle" && (
          <span className="text-xs text-notion-text-secondary">
            Unsaved changes
          </span>
        )}
      </div>
    </div>
  );
}
