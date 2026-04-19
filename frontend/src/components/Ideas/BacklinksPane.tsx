import { useMemo, useState } from "react";
import { Link as LinkIcon, Eye, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useBacklinks } from "../../hooks/useBacklinks";
import { useNoteContext } from "../../hooks/useNoteContext";

interface BacklinksPaneProps {
  noteId: string;
}

type Tab = "backlinks" | "unlinked";

export function BacklinksPane({ noteId }: BacklinksPaneProps) {
  const { t } = useTranslation();
  const { backlinks, unlinked, loading } = useBacklinks(noteId);
  const { notes, setSelectedNoteId } = useNoteContext();
  const [tab, setTab] = useState<Tab>("backlinks");

  const grouped = useMemo(() => {
    const map = new Map<string, typeof backlinks>();
    for (const hit of backlinks) {
      const key = hit.link.sourceNoteId ?? hit.link.sourceMemoDate ?? "unknown";
      const list = map.get(key) ?? [];
      list.push(hit);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [backlinks]);

  const total = backlinks.length;
  const unlinkedCount = unlinked.length;

  return (
    <div className="mt-6 border-t border-notion-border pt-4 text-sm">
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={() => setTab("backlinks")}
          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
            tab === "backlinks"
              ? "bg-notion-hover text-notion-text"
              : "text-notion-text-secondary hover:bg-notion-hover/50"
          }`}
        >
          <LinkIcon size={12} />
          {t("backlinks.title")}
          {total > 0 && (
            <span className="text-[10px] opacity-70">({total})</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab("unlinked")}
          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
            tab === "unlinked"
              ? "bg-notion-hover text-notion-text"
              : "text-notion-text-secondary hover:bg-notion-hover/50"
          }`}
        >
          <Search size={12} />
          {t("backlinks.unlinkedMentions")}
          {unlinkedCount > 0 && (
            <span className="text-[10px] opacity-70">({unlinkedCount})</span>
          )}
        </button>
      </div>

      {loading && (
        <div className="text-xs text-notion-text-secondary py-2">
          {t("backlinks.loading")}
        </div>
      )}

      {!loading && tab === "backlinks" && (
        <>
          {grouped.length === 0 ? (
            <div className="text-xs text-notion-text-secondary/70 py-2">
              {t("backlinks.empty")}
            </div>
          ) : (
            <ul className="space-y-2">
              {grouped.map(([key, hits]) => {
                const first = hits[0];
                const sourceTitle = first.sourceTitle ?? key;
                const sourceNoteId = first.link.sourceNoteId;
                return (
                  <li
                    key={key}
                    className="rounded border border-notion-border bg-notion-bg-hover/30 px-2 py-1.5"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (sourceNoteId) setSelectedNoteId(sourceNoteId);
                      }}
                      className="flex items-center gap-1.5 text-xs font-medium text-notion-text hover:underline"
                    >
                      <LinkIcon size={11} className="opacity-60" />
                      <span className="truncate">{sourceTitle}</span>
                      {hits.length > 1 && (
                        <span className="text-[10px] opacity-60">
                          ×{hits.length}
                        </span>
                      )}
                    </button>
                    {first.sourcePreview && (
                      <p className="mt-1 text-[11px] text-notion-text-secondary line-clamp-2">
                        {first.sourcePreview}
                      </p>
                    )}
                    {hits.some(
                      (h) => h.link.targetHeading || h.link.targetBlockId,
                    ) && (
                      <ul className="mt-1 space-y-0.5">
                        {hits.map((h) => {
                          const suffix =
                            (h.link.targetHeading
                              ? `#${h.link.targetHeading}`
                              : "") +
                            (h.link.targetBlockId
                              ? `#^${h.link.targetBlockId}`
                              : "");
                          if (!suffix) return null;
                          return (
                            <li
                              key={h.link.id}
                              className="text-[10px] text-notion-text-secondary opacity-80"
                            >
                              {suffix}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {!loading && tab === "unlinked" && (
        <>
          {unlinked.length === 0 ? (
            <div className="text-xs text-notion-text-secondary/70 py-2">
              {t("backlinks.noUnlinkedMentions")}
            </div>
          ) : (
            <ul className="space-y-1">
              {unlinked.map((u, idx) => {
                const target = notes.find(
                  (n) => n.title === u.matchText && n.type === "note",
                );
                return (
                  <li
                    key={`${u.matchText}-${idx}`}
                    className="flex items-center gap-1.5 text-xs text-notion-text"
                  >
                    <Eye size={11} className="opacity-60 shrink-0" />
                    <button
                      type="button"
                      onClick={() => {
                        if (target) setSelectedNoteId(target.id);
                      }}
                      className="hover:underline truncate"
                    >
                      {u.matchText}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
