import { cn, useWikiTagsUnifiedContext } from "@life-editor/shared";

/*
 * A row's tags as a dot and a name each, read-only (#2408). The Schedule tray's
 * rows draw this under the title, and tags are edited in the todo's panel
 * through <TagPicker>.
 *
 * Reads the same bulk cache as <TagPicker>, so a list of N rows issues no
 * fetches of its own. It draws nothing while that cache loads or when the item
 * has no tags: the row is complete without this line, and a placeholder per row
 * would only make the list jump when the cache arrives.
 */
export function TagDotNames({ itemId }: { itemId: string }) {
  const { allTags, getTagsForItem, loading } = useWikiTagsUnifiedContext();
  if (loading) return null;
  const tags = getTagsForItem(itemId).flatMap((assignment) => {
    const tag = allTags.find((t) => t.id === assignment.tagId);
    return tag ? [tag] : [];
  });
  if (tags.length === 0) return null;
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
      {tags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex min-w-0 items-center gap-1 text-xs text-lumen-text-secondary"
        >
          <span
            aria-hidden
            style={tag.color ? { backgroundColor: tag.color } : undefined}
            className={cn(
              "size-2 shrink-0 rounded-full",
              !tag.color && "bg-lumen-text-secondary",
            )}
          />
          <span className="truncate">{tag.name}</span>
        </span>
      ))}
    </span>
  );
}
