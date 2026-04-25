import { useEffect } from "react";
import { Undo2, Redo2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useUndoRedo } from "../../../hooks/useUndoRedo";
import type { UndoDomain } from "../../../utils/undoRedo/types";

interface UndoRedoButtonsProps {
  /** @deprecated Use `domains` instead */
  domain?: UndoDomain;
  domains?: UndoDomain[];
}

export function UndoRedoButtons({ domain, domains }: UndoRedoButtonsProps) {
  const { t } = useTranslation();
  const {
    undo,
    redo,
    canUndo,
    canRedo,
    setActiveDomain,
    undoLatest,
    redoLatest,
    canUndoAny,
    canRedoAny,
    setActiveDomains,
    getActiveEditor,
  } = useUndoRedo();

  const resolvedDomains = domains ?? (domain ? [domain] : []);
  const isMulti = resolvedDomains.length > 1;

  const activeEditor = getActiveEditor();
  const editorActive =
    activeEditor && !activeEditor.isDestroyed && activeEditor.isEditable;
  const editorCanUndo = editorActive ? activeEditor.can().undo() : false;
  const editorCanRedo = editorActive ? activeEditor.can().redo() : false;

  const domainHasUndo = isMulti
    ? canUndoAny(resolvedDomains)
    : resolvedDomains.length === 1
      ? canUndo(resolvedDomains[0])
      : false;
  const domainHasRedo = isMulti
    ? canRedoAny(resolvedDomains)
    : resolvedDomains.length === 1
      ? canRedo(resolvedDomains[0])
      : false;

  const hasUndo = editorCanUndo || domainHasUndo;
  const hasRedo = editorCanRedo || domainHasRedo;

  useEffect(() => {
    if (isMulti) {
      setActiveDomains(resolvedDomains);
      return () => setActiveDomains(null);
    }
    if (resolvedDomains.length === 1) {
      setActiveDomain(resolvedDomains[0]);
      return () => setActiveDomain(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedDomains.join(","), setActiveDomain, setActiveDomains]);

  const handleUndo = () => {
    const editor = getActiveEditor();
    if (
      editor &&
      !editor.isDestroyed &&
      editor.isEditable &&
      editor.can().undo()
    ) {
      editor.commands.undo();
      return;
    }
    if (isMulti) {
      undoLatest(resolvedDomains);
    } else if (resolvedDomains.length === 1) {
      undo(resolvedDomains[0]);
    }
  };

  const handleRedo = () => {
    const editor = getActiveEditor();
    if (
      editor &&
      !editor.isDestroyed &&
      editor.isEditable &&
      editor.can().redo()
    ) {
      editor.commands.redo();
      return;
    }
    if (isMulti) {
      redoLatest(resolvedDomains);
    } else if (resolvedDomains.length === 1) {
      redo(resolvedDomains[0]);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handleUndo}
        disabled={!hasUndo}
        className={`p-1.5 rounded transition-colors ${
          hasUndo
            ? "text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover"
            : "opacity-30 cursor-default"
        }`}
        title={t("common.undo")}
      >
        <Undo2 size={16} />
      </button>
      <button
        onClick={handleRedo}
        disabled={!hasRedo}
        className={`p-1.5 rounded transition-colors ${
          hasRedo
            ? "text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover"
            : "opacity-30 cursor-default"
        }`}
        title={t("common.redo")}
      >
        <Redo2 size={16} />
      </button>
    </div>
  );
}
