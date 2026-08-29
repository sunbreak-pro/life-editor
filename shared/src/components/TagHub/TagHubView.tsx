import { ChevronLeft, Tags } from "lucide-react";
import { cn } from "../cn";
import { EmptyState } from "../EmptyState";
import { IconButton } from "../IconButton";
import { SkeletonList } from "../SkeletonList";
import { TagHeadingIcon } from "../TagHeadingIcon";
import { TagHubItemGroups } from "./TagHubItemGroups";
import { TagHubTagRail } from "./TagHubTagRail";
import type { TagHubItem, TagHubLabels, TagHubModel } from "./types";

/*
 * The Connect section's body (#1171) — a tag hub, the Wikipedia category page
 * for your own records: pick a topic on the left, read everything filed under
 * it on the right, grouped by kind.
 *
 * It replaces the force-directed graph #1152 retired. The graph drew every
 * relationship at once and left you to find the one you meant; this asks for
 * the topic first and then shows only its rows, which is the reading the
 * author actually wanted out of it ("this topic's total, and what moved
 * lately").
 *
 * LAYOUT. Wide is master + detail side by side. Narrow is the same two panes
 * one at a time — the tag list, then the items with a back arrow — rather than
 * a squeezed rail, because a 260px column and a list of titles do not both fit
 * on a phone. `wide` is passed in, not measured here: the host owns the media
 * query (§6.4) and jsdom has no layout to measure anyway (CLAUDE.md §7.1).
 *
 * Pure presentation. The state (which tag, what filter text) is the host's,
 * data and copy are injected, and nothing here reaches a DataService (§3.1).
 */

export interface TagHubViewProps {
  model: TagHubModel;
  /** The selected tag id — null on narrow means "showing the tag list". */
  selectedTagId: string | null;
  onSelectTag: (tagId: string | null) => void;
  query: string;
  onQueryChange: (query: string) => void;
  /** Row click — the host routes it to the shell's item-nav. */
  onOpenItem: (item: TagHubItem) => void;
  /** Count → its accessible text ("3 items"). */
  formatCount: (count: number) => string;
  /** Wide layout (master + detail) vs. narrow (one pane at a time). */
  wide: boolean;
  /** True until the host's first reads land, so an empty hub cannot flash. */
  isLoading: boolean;
  labels: TagHubLabels;
}

export function TagHubView({
  model,
  selectedTagId,
  onSelectTag,
  query,
  onQueryChange,
  onOpenItem,
  formatCount,
  wide,
  isLoading,
  labels,
}: TagHubViewProps) {
  if (isLoading) {
    return (
      <div className="h-full p-4">
        <SkeletonList rows={6} />
      </div>
    );
  }

  const trimmed = query.trim().toLowerCase();
  const visibleTags = trimmed
    ? model.tags.filter((tag) => tag.name.toLowerCase().includes(trimmed))
    : model.tags;

  const selected = selectedTagId
    ? (model.tags.find((tag) => tag.id === selectedTagId) ?? null)
    : null;
  const groups = selected ? (model.groupsByTag.get(selected.id) ?? []) : [];

  const rail = (
    <TagHubTagRail
      tags={model.tags}
      visibleTags={visibleTags}
      selectedId={selectedTagId}
      onSelect={onSelectTag}
      query={query}
      onQueryChange={onQueryChange}
      formatCount={formatCount}
      wide={wide}
      labels={labels}
    />
  );

  // Narrow shows one pane at a time, and the tag list IS the landing pane —
  // so nothing is selected until the user picks, and the back arrow clears the
  // selection to return. Wide has no such mode: both panes are always up.
  if (!wide && selected === null) {
    return <div className="flex h-full min-h-0 flex-col">{rail}</div>;
  }

  const detail = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {selected && (
        <div className="flex flex-shrink-0 items-center gap-2 border-b border-lumen-border px-3 py-2.5">
          {!wide && (
            <IconButton
              icon={<ChevronLeft size={18} />}
              label={labels.back}
              variant="ghost"
              size="md"
              onClick={() => onSelectTag(null)}
            />
          )}
          <TagHeadingIcon icon={selected.icon} color={selected.color} />
          <h2
            className={cn(
              "min-w-0 flex-1 truncate text-sm font-semibold",
              selected.isUntagged
                ? "text-lumen-text-secondary"
                : "text-lumen-text",
            )}
          >
            {selected.name}
          </h2>
          <span className="shrink-0 text-xs tabular-nums text-lumen-text-tertiary">
            {formatCount(selected.count)}
          </span>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {selected === null ? (
          <EmptyState icon={<Tags />} message={labels.selectHint} />
        ) : groups.length === 0 ? (
          <EmptyState icon={<Tags />} message={labels.tagEmpty} />
        ) : (
          <TagHubItemGroups
            groups={groups}
            onOpenItem={onOpenItem}
            formatCount={formatCount}
            labels={labels}
          />
        )}
      </div>
    </div>
  );

  if (!wide)
    return <div className="flex h-full min-h-0 flex-col">{detail}</div>;

  return (
    <div className="flex h-full min-h-0 w-full">
      {rail}
      {detail}
    </div>
  );
}
