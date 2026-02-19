import { useEffect } from "react";
import { Undo2, Redo2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useUndoRedo } from "./useUndoRedo";
import type { UndoDomain } from "./types";

interface UndoRedoButtonsProps {
  domain: UndoDomain;
}

export function UndoRedoButtons({ domain }: UndoRedoButtonsProps) {
  const { t } = useTranslation();
  const { undo, redo, canUndo, canRedo, setActiveDomain } = useUndoRedo();

  const hasUndo = canUndo(domain);
  const hasRedo = canRedo(domain);

  useEffect(() => {
    setActiveDomain(domain);
    return () => setActiveDomain(null);
  }, [domain, setActiveDomain]);

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => undo(domain)}
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
        onClick={() => redo(domain)}
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
