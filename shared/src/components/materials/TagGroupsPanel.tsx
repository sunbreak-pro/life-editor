import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "../cn";

/*
 * Tag groups panel (Materials mini-plan Step 5). The right-hand pane the Tags
 * tab pushes into the shared rightSidebar (Desktop only) — always-present
 * content (not selection-driven), mirroring DailyEntriesPanel. Renders the
 * group cards: a name heading, the member chips (color dot + name + remove),
 * and a dashed "+ tag" pill that opens a small candidate picker.
 *
 * Pure presentation, DataService-free (§3.1): create / add / remove are all
 * host-injected callbacks, the group / member / candidate data arrives as
 * props, and every string is already-translated (§6.4 — no useTranslation
 * here). lumen-* tokens only; the tag dot colors are user data applied via
 * inline style (allowed — same rule as TagPill / ColorPicker).
 */

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent";

export interface TagGroupsPanelMember {
  /** Tag id — the onAddMember / onRemoveMember payload. */
  tagId: string;
  name: string;
  /** Optional user-data tint (inline style). */
  color: string | null;
}

export interface TagGroupsPanelGroup {
  id: string;
  name: string;
  /** Tags currently assigned to this group. */
  members: TagGroupsPanelMember[];
  /** Tags NOT yet in this group — the "+ tag" picker pool. */
  candidates: TagGroupsPanelMember[];
}

export interface TagGroupsPanelProps {
  /** Already-translated heading, e.g. "Groups (3)". */
  heading: string;
  /** Already-translated "+ group" button label. */
  createGroupLabel: string;
  groups: TagGroupsPanelGroup[];
  onCreateGroup: () => void;
  onAddMember: (groupId: string, tagId: string) => void;
  onRemoveMember: (groupId: string, tagId: string) => void;
  /** Already-translated dashed "+ add tag" pill label. */
  addTagLabel: string;
  /** Already-translated candidate search placeholder. */
  addTagSearchPlaceholder: string;
  /** Already-translated aria-label prefix for a member's remove button. */
  removeMemberLabel: string;
  /** Already-translated "no more tags to add" line. */
  noCandidatesLabel: string;
  /** Already-translated zero-groups line. */
  emptyLabel: string;
  className?: string;
}

function TagDot({ color }: { color: string | null }) {
  return (
    <span
      aria-hidden
      className={cn(
        "h-2 w-2 shrink-0 rounded-full",
        color ? "" : "bg-lumen-border-strong",
      )}
      style={color ? { backgroundColor: color } : undefined}
    />
  );
}

function GroupCard({
  group,
  onAddMember,
  onRemoveMember,
  addTagLabel,
  addTagSearchPlaceholder,
  removeMemberLabel,
  noCandidatesLabel,
}: {
  group: TagGroupsPanelGroup;
  onAddMember: (groupId: string, tagId: string) => void;
  onRemoveMember: (groupId: string, tagId: string) => void;
  addTagLabel: string;
  addTagSearchPlaceholder: string;
  removeMemberLabel: string;
  noCandidatesLabel: string;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return group.candidates.slice(0, 8);
    return group.candidates
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, group.candidates]);

  const closeAdd = () => {
    setAddOpen(false);
    setQuery("");
  };

  return (
    <div className="flex flex-col gap-2.5 rounded-lumen-md border border-lumen-border bg-lumen-bg-secondary p-3">
      <div className="text-[13.5px] font-semibold text-lumen-text">
        {group.name}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {group.members.map((member) => (
          <span
            key={member.tagId}
            className="inline-flex items-center gap-1.5 rounded-full border border-lumen-border bg-lumen-bg py-1 pl-2.5 pr-1.5 text-[12px] text-lumen-text"
          >
            <TagDot color={member.color} />
            {member.name}
            <button
              type="button"
              onClick={() => onRemoveMember(group.id, member.tagId)}
              aria-label={`${removeMemberLabel}: ${member.name}`}
              className={cn(
                "grid h-3.5 w-3.5 place-items-center rounded-full text-lumen-text-tertiary",
                "hover:text-lumen-danger",
                FOCUS_RING,
              )}
            >
              <X size={11} aria-hidden />
            </button>
          </span>
        ))}

        <button
          type="button"
          onClick={() => setAddOpen((v) => !v)}
          aria-expanded={addOpen}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border border-dashed border-lumen-border-strong px-2.5 py-1",
            "text-[12px] text-lumen-text-tertiary hover:text-lumen-text",
            FOCUS_RING,
          )}
        >
          <Plus size={11} aria-hidden />
          {addTagLabel}
        </button>
      </div>

      {addOpen && (
        <div className="flex flex-col gap-1 rounded-lumen-md border border-lumen-border bg-lumen-bg p-1.5">
          <input
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
            placeholder={addTagSearchPlaceholder}
            className={cn(
              "w-full rounded-lumen-md border border-lumen-border bg-lumen-bg-secondary px-2 py-1 text-[12px] text-lumen-text",
              "placeholder:text-lumen-text-tertiary",
              FOCUS_RING,
            )}
          />
          <ul className="max-h-32 space-y-0.5 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-2 py-1 text-[12px] text-lumen-text-tertiary">
                {noCandidatesLabel}
              </li>
            ) : (
              filtered.map((candidate) => (
                <li key={candidate.tagId}>
                  <button
                    type="button"
                    onClick={() => {
                      onAddMember(group.id, candidate.tagId);
                      closeAdd();
                    }}
                    className={cn(
                      "flex w-full items-center gap-1.5 rounded-lumen-md px-2 py-1 text-left text-[12px] text-lumen-text",
                      "hover:bg-lumen-hover",
                      FOCUS_RING,
                    )}
                  >
                    <TagDot color={candidate.color} />
                    {candidate.name}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export function TagGroupsPanel({
  heading,
  createGroupLabel,
  groups,
  onCreateGroup,
  onAddMember,
  onRemoveMember,
  addTagLabel,
  addTagSearchPlaceholder,
  removeMemberLabel,
  noCandidatesLabel,
  emptyLabel,
  className,
}: TagGroupsPanelProps) {
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-lumen-text">
          {heading}
        </span>
        <button
          type="button"
          onClick={onCreateGroup}
          className={cn(
            "inline-flex items-center gap-1 rounded-lumen-md border border-lumen-border bg-lumen-bg px-2 py-1",
            "text-[11.5px] font-medium text-lumen-text-secondary hover:bg-lumen-hover hover:text-lumen-text",
            FOCUS_RING,
          )}
        >
          <Plus size={11} aria-hidden />
          {createGroupLabel}
        </button>
      </div>

      {groups.length === 0 ? (
        <p className="px-0.5 py-2 text-[12px] text-lumen-text-tertiary">
          {emptyLabel}
        </p>
      ) : (
        groups.map((group) => (
          <GroupCard
            key={group.id}
            group={group}
            onAddMember={onAddMember}
            onRemoveMember={onRemoveMember}
            addTagLabel={addTagLabel}
            addTagSearchPlaceholder={addTagSearchPlaceholder}
            removeMemberLabel={removeMemberLabel}
            noCandidatesLabel={noCandidatesLabel}
          />
        ))
      )}
    </div>
  );
}
