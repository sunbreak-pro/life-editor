import { useEffect, useMemo, useState } from "react";
import { Link2, Plus, X } from "lucide-react";
import {
  useWikiTagsUnifiedContext,
  type WikiTagConnectionUnified,
} from "@life-editor/shared";

/*
 * LinkPanel — outgoing + incoming item↔item links for a single item
 * (DU-F Step 6).
 *
 * Self-contained: loads both directions from
 * useWikiTagsUnifiedContext, presents an Obsidian-style backlink list
 * (incoming) and the editable outgoing list with a "+ Link" affordance.
 *
 * Title resolution: each role passes a `resolveTitle(id) → string |
 * undefined` callback (its own context already has the items). When a
 * link points outside the resolver's domain (e.g. Note→Event) we render
 * the truncated id with a small "external" hint — DU-G unifies the
 * resolver into items_meta and removes the per-role wiring.
 *
 * Add-link UX: text input + optional <datalist> of `linkableItems`. The
 * datalist gives autocomplete for ids the caller knows; users can still
 * paste any items_meta.id by hand (cross-role link).
 */
interface LinkableItem {
  id: string;
  label: string;
}

interface LinkPanelProps {
  itemId: string;
  resolveTitle?: (itemId: string) => string | undefined;
  linkableItems?: LinkableItem[];
}

export function LinkPanel({
  itemId,
  resolveTitle,
  linkableItems = [],
}: LinkPanelProps) {
  const wiki = useWikiTagsUnifiedContext();
  const [outgoing, setOutgoing] = useState<WikiTagConnectionUnified[]>([]);
  const [incoming, setIncoming] = useState<WikiTagConnectionUnified[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([wiki.listLinksFromItem(itemId), wiki.listLinksToItem(itemId)])
      .then(([from, to]) => {
        if (cancelled) return;
        setOutgoing(from);
        setIncoming(to);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [itemId, wiki]);

  const datalistId = useMemo(
    () => `link-targets-${itemId.replace(/[^a-zA-Z0-9_-]/g, "-")}`,
    [itemId],
  );

  const handleAdd = async () => {
    setError(null);
    const trimmed = target.trim();
    if (!trimmed) return;
    if (trimmed === itemId) {
      setError("Self-link is not allowed.");
      return;
    }
    // Datalist matches send the label as value (browser-dependent). Try
    // to resolve back to an id; otherwise treat the raw value as the id.
    const matchedById = linkableItems.find((i) => i.id === trimmed);
    const matchedByLabel = linkableItems.find((i) => i.label === trimmed);
    const targetId = matchedById?.id ?? matchedByLabel?.id ?? trimmed;
    if (targetId === itemId) {
      setError("Self-link is not allowed.");
      return;
    }
    try {
      const created = await wiki.createItemLink(itemId, targetId);
      setOutgoing((prev) => [...prev, created]);
      setTarget("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = async (linkId: string) => {
    try {
      await wiki.deleteItemLink(linkId);
      setOutgoing((prev) => prev.filter((l) => l.id !== linkId));
    } catch (err) {
      console.error("deleteItemLink failed", err);
    }
  };

  const renderItemLabel = (id: string) => {
    const fromResolver = resolveTitle?.(id);
    if (fromResolver) return fromResolver;
    const fromList = linkableItems.find((i) => i.id === id)?.label;
    if (fromList) return fromList;
    // Fallback: shorten the id (last 8 chars) — the user can still see
    // which row it is by hovering for the full id.
    return id.length > 12 ? `…${id.slice(-8)}` : id;
  };

  return (
    <section
      aria-label="Links"
      className="space-y-2 rounded-md border border-notion-border bg-notion-bg-secondary p-2"
    >
      <header className="flex items-center gap-1 text-xs font-semibold text-notion-text-secondary">
        <Link2 size={12} aria-hidden />
        Links
      </header>

      <div className="flex flex-wrap items-center gap-1">
        <input
          type="text"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void handleAdd();
            }
          }}
          list={linkableItems.length > 0 ? datalistId : undefined}
          placeholder="Link to id…"
          aria-label="Link target"
          className="min-w-[8rem] flex-1 rounded-md border border-notion-border bg-notion-bg px-2 py-1 text-xs text-notion-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-notion-accent"
        />
        {linkableItems.length > 0 && (
          <datalist id={datalistId}>
            {linkableItems.map((i) => (
              <option key={i.id} value={i.id}>
                {i.label}
              </option>
            ))}
          </datalist>
        )}
        <button
          type="button"
          onClick={() => void handleAdd()}
          aria-label="Add link"
          className="inline-flex items-center gap-0.5 rounded-md border border-notion-border bg-notion-bg px-2 py-1 text-xs text-notion-text hover:bg-notion-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-notion-accent"
        >
          <Plus size={12} aria-hidden />
          Add
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-notion-danger px-2 py-1 text-xs text-notion-danger"
        >
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-xs text-notion-text-secondary">Loading links…</p>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <h4 className="mb-1 text-xs font-medium text-notion-text-secondary">
              Outgoing ({outgoing.length})
            </h4>
            {outgoing.length === 0 ? (
              <p className="text-xs text-notion-text-secondary">No links.</p>
            ) : (
              <ul className="space-y-0.5">
                {outgoing.map((link) => (
                  <li
                    key={link.id}
                    className="flex items-center justify-between gap-1 rounded-md border border-notion-border bg-notion-bg px-1.5 py-0.5 text-xs text-notion-text"
                  >
                    <span
                      title={link.toItemId}
                      className="truncate text-notion-text"
                    >
                      → {renderItemLabel(link.toItemId)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleDelete(link.id)}
                      aria-label="Remove link"
                      className="text-notion-text-secondary hover:text-notion-danger focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-notion-accent rounded"
                    >
                      <X size={10} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h4 className="mb-1 text-xs font-medium text-notion-text-secondary">
              Backlinks ({incoming.length})
            </h4>
            {incoming.length === 0 ? (
              <p className="text-xs text-notion-text-secondary">
                No backlinks.
              </p>
            ) : (
              <ul className="space-y-0.5">
                {incoming.map((link) => (
                  <li
                    key={link.id}
                    className="rounded-md border border-notion-border bg-notion-bg px-1.5 py-0.5 text-xs text-notion-text"
                    title={link.fromItemId}
                  >
                    ← {renderItemLabel(link.fromItemId)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
