import { useEffect } from "react";
import { Undo2, Redo2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useUndoRedo } from "./useUndoRedo";
import type { UndoDomain } from "./types";

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
  } = useUndoRedo();

  const resolvedDomains = domains ?? (domain ? [domain] : []);
  const isMulti = resolvedDomains.length > 1;

  const hasUndo = isMulti
    ? canUndoAny(resolvedDomains)
    : resolvedDomains.length === 1
      ? canUndo(resolvedDomains[0])
      : false;
  const hasRedo = isMulti
    ? canRedoAny(resolvedDomains)
    : resolvedDomains.length === 1
      ? canRedo(resolvedDomains[0])
      : false;

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
    if (isMulti) {
      undoLatest(resolvedDomains);
    } else if (resolvedDomains.length === 1) {
      undo(resolvedDomains[0]);
    }
  };

  const handleRedo = () => {
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
