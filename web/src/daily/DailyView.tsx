import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Calendar, MoreHorizontal, Pin, Trash2 } from "lucide-react";
import {
  useDailiesUnifiedContext,
  useLocalStorage,
  useMediaQuery,
  useRightSidebarOptional,
  useTranslation,
  Menu,
  MenuItem,
  RightSidebarPortal,
  DailyEntriesPanel,
  DailyEveningCard,
  SidebarListControls,
  cn,
  dailyContentToEditorContent,
  dailyContentExcerpt,
  dailyContentHasRenderedContent,
  extractEveningSection,
  eveningBodyLines,
  mergeEveningSection,
  stripEveningSection,
  filterAndSortDailyEntries,
  jsonDocEquals,
  createPendingItemLinks,
  queuePendingItemLink,
  takePendingItemLinks,
  extractItemLinkTargets,
  type DailyNode,
  type DailyEntriesPanelEntry,
  type DailyListDirection,
  type DailyListSortMode,
  type DataService,
  FOCUS_RING_TIGHT as FOCUS_RING,
  formatDateKey,
  WIDE_QUERY,
  dateFromKey,
} from "@life-editor/shared";
import { LazyRichTextEditor } from "../notes/LazyRichTextEditor";
import {
  useItemLinkTargets,
  type LoadItemLinkTargets,
} from "../notes/useItemLinkTargets";
import { useInlineItemLinks } from "../hooks/useInlineItemLinks";
import { useDayScheduleSummary } from "./useDayScheduleSummary";

/*
 * Web Daily tab (Materials mini-plan Step 4). Re-shaped to the target-IA
 * ClaudeDesign import:
 *
 *   - Desktop (isWide): a centered max-width 800px editor card (28px date
 *     heading + saved-state caption + pin / delete icon buttons + a plain-text
 *     body wired to upsertDaily-on-blur) and a "今日へ" action row.
 *   - Mobile (narrow): a "今日へ" + pin action row and the same editor card
 *     (19px date).
 *
 * The past-entries UI — sort / direction / filter above the shared
 * <DailyEntriesPanel> (date picker + chronological entry list) — is PUSHED INTO
 * THE SHARED detail panel via RightSidebarPortal at BOTH
 * widths since #876 (ユーザー裁定 D-20260815-materials-2 = A): the push-in
 * rightSidebar on Desktop, the hamburger's <MobileDrawer> on narrow. It is
 * always-present content, not selection-driven.
 *
 * What #876 retired on narrow: the "過去のエントリ" teaser of the two most
 * recent other entries, which sat under the editor. It was a fixed 2-row
 * stand-in for a list there was nowhere to put (#369); the drawer is that
 * place, and it carries the whole list with the sort and filter controls.
 *
 * What #1189 retired: the rightSidebar's "今日 / 昨日" pair and the narrow
 * body's <DateStrip> of the last two weeks. Both moved the same selected date
 * the entry rows and the date picker move, so both read as filters that did
 * nothing — and the strip could only ever reach the last 14 days, which is the
 * range the entry list covers best. Arbitrary days are reached through the
 * picker, and "today" through the CTA that was always there.
 *
 * The body is the shared Notes TipTap editor (F-1 #258 — headings are what
 * makes handwritten 朝刊/夕刊 sections visible to extractBriefing). The title
 * stays the fixed date ("date IS the identity"). Legacy plain-text dailies are
 * converted to a TipTap doc AT READ TIME only (dailyContentToEditorContent);
 * JSON is persisted lazily on the user's first edit, so untouched entries are
 * never rewritten. Password-lock / tags / links / trash subsystems remain out
 * of scope. Data stays context-side (useDailiesUnifiedContext); this view is
 * DataService-free (§3.1) and takes all copy from useTranslation → props
 * (§6.4). No hex — lumen-* only.
 */

function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return formatDateKey(d);
}

// `date` is a validated DailyNode.date (`YYYY-MM-DD`), so the old
// `y ?? 1970` / `(m ?? 1) - 1` fallbacks guarded a shape the mapper already
// rejects (#670 C3 PR 3).
const parseIso = dateFromKey;

// ---- Editor card (shared between Desktop / Mobile, size via props) --------

function EditorCard({
  dateLabel,
  dateClassName,
  savedLabel,
  headerActions,
  editorKey,
  date,
  initialContent,
  onUpdate,
  placeholder,
  loadLinkTargets,
  onNavigateToItem,
  onResolvedLinkInserted,
}: {
  dateLabel: string;
  dateClassName: string;
  savedLabel: string;
  headerActions?: ReactNode;
  editorKey: string;
  date: string;
  initialContent?: string;
  onUpdate: (content: string) => void;
  placeholder: string;
  loadLinkTargets?: LoadItemLinkTargets;
  onNavigateToItem?: (target: { id: string; role: string }) => void;
  onResolvedLinkInserted?: (targetId: string) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lumen-lg border border-lumen-border bg-lumen-bg-secondary shadow-lumen-sm">
      <div className="flex items-start gap-2.5 px-5 pb-1 pt-4">
        <h1 className={cn("flex-1", dateClassName)}>{dateLabel}</h1>
        <span className="pt-1.5 text-[11.5px] text-lumen-text-tertiary">
          {savedLabel}
        </span>
        {headerActions}
      </div>
      {/* TipTap (F-1 #258). IME composition is handled natively by
          ProseMirror (no manual keydown here — the isComposing gotcha cannot
          be broken); persistence is the editor's 800ms debounce + flush on
          unmount/beforeunload, the onBlur-commit equivalent. The key remounts
          the editor on date switch / external content change only — never on
          our own save echo — so typing keeps cursor + IME state. */}
      <LazyRichTextEditor
        key={editorKey}
        noteId={`daily-${date}`}
        initialContent={initialContent}
        onUpdate={onUpdate}
        placeholder={placeholder}
        // "[[" wiki-link autocomplete + click navigation (Issue #285). No
        // create-note row here (Daily has no note-create path) — the daily
        // editor only links to EXISTING items.
        loadLinkTargets={loadLinkTargets}
        onNavigateToItem={onNavigateToItem}
        onResolvedLinkInserted={onResolvedLinkInserted}
        className="daily-editor min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-1"
      />
    </div>
  );
}

interface DailyViewProps {
  /** Injected for the "[[" link-target pool (notes + dailies, cross-domain). */
  dataService?: DataService;
  /** Navigate to a link target (MainScreen owns section + tab switching). */
  onNavigateToItem?: (target: { id: string; role: string }) => void;
  /** A pending daily date to open (arrived via a link click from another tab). */
  pendingSelectDate?: string | null;
  /** Clear the pending selection once consumed. */
  onConsumePendingSelect?: () => void;
}

export function DailyView({
  dataService,
  onNavigateToItem,
  pendingSelectDate,
  onConsumePendingSelect,
}: DailyViewProps = {}) {
  const {
    dailies,
    selectedDate,
    setSelectedDate,
    selectedDaily,
    upsertDaily,
    deleteDaily,
    togglePin,
  } = useDailiesUnifiedContext();
  // "[[" → item_links, shared with Notes and Todos (#776). Daily differs only
  // in WHEN the edge can be written (see the park / flush below); the write
  // itself and the save-time delete-sync are the shared ones.
  const { mirrorInlineLink, syncSavedBody } = useInlineItemLinks("DailyView");
  const { t, i18n } = useTranslation();
  const isWide = useMediaQuery(WIDE_QUERY, true);
  // Null-safe, like RightSidebarPortal's own read: this tab renders standalone
  // in tests and has never required the panel Provider to draw its editor.
  const rightSidebar = useRightSidebarOptional();

  // "[[" link-target pool (notes + dailies + todos, cross-domain). A loader,
  // not a list: nothing is fetched until the first "[[" (#430).
  const loadLinkTargets = useItemLinkTargets(dataService);

  // A link click from the Notes tab lands here with a pending date — open it
  // once, then clear.
  useEffect(() => {
    if (!pendingSelectDate) return;
    setSelectedDate(pendingSelectDate);
    onConsumePendingSelect?.();
    // setSelectedDate / onConsumePendingSelect are stable; rerun on new date.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSelectDate]);

  // Mirror a resolved "[[" link into the item_links graph as an edge from the
  // current daily to the target. `wiki_tag_connections.from_item_id` is a NOT
  // NULL FK to items_meta, and a brand-new day has no row there until its first
  // save lands — the previous guard therefore dropped that first edge for good
  // (#371). Local presence is no help either: the optimistic DailyNode appears
  // well before the write completes, so `selectedDaily` being set was never
  // proof the FK target existed.
  //
  // So every insertion parks under its DATE (the row's id isn't knowable yet)
  // and is written by the save that persists the text carrying the link —
  // inserting a link dirties the editor, so a save always follows within the
  // 800ms debounce. Parking is the whole of what is Daily-specific: strip it
  // away and the remainder is the shared mirrorInlineLink / syncSavedBody pair.
  const pendingLinksRef = useRef(createPendingItemLinks());

  const handleResolvedLinkInserted = useCallback(
    (targetId: string) => {
      if (!targetId) return;
      queuePendingItemLink(pendingLinksRef.current, selectedDate, targetId);
    },
    [selectedDate],
  );

  // Drain one date's parked edges once its row is known to exist. A failed
  // save resolves to null — leave the queue alone so the next save retries.
  // `bodyJson` is the body that save persisted: a queued target the user
  // already removed again (insert → delete within one debounce window) is
  // dropped instead of minting an edge its text no longer carries (#372).
  const flushPendingLinks = useCallback(
    (date: string, saved: DailyNode | null, bodyJson: string) => {
      if (!saved) return;
      const present = extractItemLinkTargets(bodyJson);
      for (const targetId of takePendingItemLinks(
        pendingLinksRef.current,
        date,
      )) {
        if (present !== null && !present.includes(targetId)) continue;
        // Duplicate guard, self-link skip and the "inline" origin all come from
        // the shared hook — a day linking to itself is dropped there.
        mirrorInlineLink(saved.id, targetId);
      }
    },
    [mirrorInlineLink],
  );

  // Header actions kebab (#284) — collapsed pin / delete menu.
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsTriggerRef = useRef<HTMLButtonElement>(null);

  const isJa = i18n.language.startsWith("ja");
  const localeTag = isJa ? "ja-JP" : "en-US";
  const weekdayShort = useMemo(
    () => new Intl.DateTimeFormat(localeTag, { weekday: "short" }),
    [localeTag],
  );

  // The TipTap editor owns its draft and ignores initialContent changes once
  // mounted, so remount (key bump) exactly when the STORED content for the
  // open date changes from outside this editor: initial async load landing,
  // a sync refetch, an MCP write. Our own saves echo back through upsertDaily's
  // optimistic update — lastEmitted recognises them (its setState batches with
  // upsertDaily's, so the echo render sees both) and typing never remounts
  // (which would drop cursor + IME state). lastEmitted carries its date so an
  // unmount flush racing a date switch never leaks into the new date's
  // comparisons. "Adjust state during render"
  // (https://react.dev/learn/you-might-not-need-an-effect).
  const selectedContent = selectedDaily?.content ?? "";
  const [lastEmitted, setLastEmitted] = useState<{
    date: string;
    json: string;
  } | null>(null);
  const [editorGen, setEditorGen] = useState(0);
  const [syncedFrom, setSyncedFrom] = useState<{
    date: string;
    content: string;
  }>({ date: selectedDate, content: selectedContent });

  // Semantic (not byte) comparison: the stored content round-trips through a
  // Postgres jsonb column, which reorders object keys — the refetched echo of
  // our own save comes back byte-different but document-identical, and a
  // byte-exact check here remounted the editor on every save echo (#300).
  const ownEcho = useMemo(
    () =>
      lastEmitted !== null &&
      lastEmitted.date === selectedDate &&
      jsonDocEquals(lastEmitted.json, selectedContent),
    [lastEmitted, selectedDate, selectedContent],
  );

  if (
    syncedFrom.date !== selectedDate ||
    syncedFrom.content !== selectedContent
  ) {
    if (syncedFrom.date === selectedDate && !ownEcho) {
      setEditorGen((g) => g + 1);
    }
    setSyncedFrom({ date: selectedDate, content: selectedContent });
  }

  // 夕刊カテゴリ (#1046): the evening section stays IN the stored content
  // (same rows, same sync, same MCP reach — zero migration), but it no longer
  // renders inside the body editor. The editor mounts the day WITHOUT it and
  // the card below prints it, so the split is entirely presentational.
  const eveningStored = useMemo(
    () => extractEveningSection(selectedContent),
    [selectedContent],
  );
  const eveningLines = useMemo(
    () => eveningBodyLines(eveningStored.bodyDocJson),
    [eveningStored],
  );
  const daySchedule = useDayScheduleSummary(dataService, selectedDate);

  // Lazy plain→TipTap conversion happens here, at read time; JSON is only
  // persisted when the editor emits an update (i.e. the user edited).
  const editorContent = dailyContentToEditorContent(
    stripEveningSection(selectedContent),
  );
  const editorKey = `${selectedDate}:${editorGen}`;

  const handleEditorUpdate = (json: string) => {
    // The old blur-commit skipped no-op saves; keep its spirit for the one
    // case TipTap still emits without visible content: typing then deleting
    // everything on a day that has no stored entry would otherwise mint an
    // empty DailyNode (and bump the sync cursor).
    //
    // "Visible content" is NOT "has text": a resolved `[[ ]]` link is an inline
    // atom carrying attrs only, so an excerpt-based check read a brand-new day
    // whose body is just a link as empty and skipped the save — losing both the
    // link text and the items_meta row its graph edge waits on (#371 left this
    // hole; the queued edge then never flushed).
    if (selectedContent === "" && !dailyContentHasRenderedContent(json)) {
      return;
    }
    // The editor emitted the day WITHOUT its evening section (#1046) — put
    // the stored 夕刊 back before persisting, so a body edit can never drop
    // what the evening paper wrote. Nothing stored → the merge returns the
    // emitted doc untouched.
    const full = mergeEveningSection(json, {
      mood: eveningStored.mood,
      bodyDocJson: eveningStored.bodyDocJson,
    });
    setLastEmitted({ date: selectedDate, json: full });
    // The date this callback closed over. The editor is remounted per date
    // (`key={editorKey}`), so an unmount flush fires the PREVIOUS instance's
    // callback — the one still holding the date it was rendered for.
    const date = selectedDate;
    void upsertDaily(date, full).then((saved) => {
      flushPendingLinks(date, saved, full);
      // #372: drop inline-origin edges whose "[[ ]]" left the text. Edges the
      // flush just created are not candidates — their targets are in `full`
      // (the evening section can carry links of its own, so the fold must
      // see the whole stored body, not just the editor's half).
      if (saved) syncSavedBody(saved.id, full);
    });
  };

  // Saves are automatic (debounced + flushed on unmount); with batched echo
  // renders this caption effectively always reads saved — kept as reassurance.
  // ownEcho (semantic compare) rather than byte equality: the canonicalized
  // jsonb echo would otherwise flip this to "unsaved" after every save.
  const isSaved =
    lastEmitted === null || lastEmitted.date !== selectedDate || ownEcho;
  const savedLabel = isSaved
    ? t("materials.daily.saved")
    : t("materials.daily.unsaved");

  // ---- date label formatters (host-side; the shared parts stay pure) ----

  const fullDateLabel = (iso: string): string => {
    const d = parseIso(iso);
    const wd = weekdayShort.format(d);
    if (isJa) {
      return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${wd}）`;
    }
    return `${wd}, ${d.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })}`;
  };

  const shortDateLabel = (iso: string): string => {
    const d = parseIso(iso);
    const wd = weekdayShort.format(d);
    if (isJa) return `${d.getMonth() + 1}月${d.getDate()}日（${wd}）`;
    return `${wd}, ${d.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
    })}`;
  };

  const entryDayLabel = (iso: string): string => {
    const d = parseIso(iso);
    const wd = weekdayShort.format(d);
    if (isJa) return `${d.getMonth() + 1}/${d.getDate()}（${wd}）`;
    return `${wd} ${d.getMonth() + 1}/${d.getDate()}`;
  };

  const todayIso = useMemo(() => isoDay(0), []);

  // #283 desktop sidebar: persisted sort direction ("desc" = newest-first, the
  // prior default) + a non-persisted filter query. #369 adds the sort MODE —
  // also persisted, defaulting to "date" so the pre-#369 order is unchanged.
  const [dailySortDirection, setDailySortDirection] =
    useLocalStorage<DailyListDirection>(
      "life-editor:daily-sort-direction",
      "desc",
    );
  const [dailySortMode, setDailySortMode] = useLocalStorage<DailyListSortMode>(
    "life-editor:daily-sort-mode",
    "date",
  );
  const [dailyFilterQuery, setDailyFilterQuery] = useState("");

  // #369: three modes, so the picker (hidden at length <= 1) now renders.
  // "date" = the entry's own day, the other two = its edit timestamps. All
  // three are time axes, so one newest/oldest direction label covers them.
  const dailySortModes = useMemo(
    () => [
      { id: "date", label: t("materials.sidebar.sortDate") },
      { id: "updatedAt", label: t("materials.sidebar.sortUpdated") },
      { id: "createdAt", label: t("materials.sidebar.sortCreated") },
    ],
    [t],
  );

  // "desc" renders newest-first, "asc" oldest-first (filterAndSortDailyEntries).
  const dailyDirectionLabel =
    dailySortDirection === "desc"
      ? t("materials.sidebar.newest")
      : t("materials.sidebar.oldest");

  const panelEntries = useMemo<DailyEntriesPanelEntry[]>(() => {
    const enriched = dailies.map((d) => {
      const dayLabel = entryDayLabel(d.date);
      const excerpt = dailyContentExcerpt(d.content);
      return {
        date: d.date,
        dayLabel,
        excerpt,
        isPinned: d.isPinned,
        selected: d.date === selectedDate,
        // searchText drives the filter: day label + the entry's body excerpt.
        searchText: `${dayLabel} ${excerpt ?? ""}`,
        // Sort keys for the timestamp modes (#369).
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      };
    });
    return filterAndSortDailyEntries(enriched, {
      mode: dailySortMode,
      direction: dailySortDirection,
      query: dailyFilterQuery,
    });
    // entryDayLabel depends only on locale (weekdayShort) — listed indirectly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    dailies,
    selectedDate,
    weekdayShort,
    dailySortMode,
    dailySortDirection,
    dailyFilterQuery,
  ]);

  // "今日へ" accent CTA — jump the selection to today.
  const toTodayButton = (
    <button
      type="button"
      onClick={() => setSelectedDate(todayIso)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lumen-md bg-lumen-accent px-3.5 py-1.5",
        "text-sm font-medium text-lumen-on-accent shadow-lumen-sm transition-opacity hover:opacity-90",
        FOCUS_RING,
      )}
    >
      <Calendar size={14} aria-hidden />
      {t("materials.daily.toToday")}
    </button>
  );

  // A single kebab that collapses the pin / delete actions behind one
  // affordance (#284). The menu opens right-anchored just beneath the trigger
  // (align="end" — a rightward panel would overflow the header's right edge).
  // Desktop / Mobile never render at once (isWide early-returns), so one open
  // state + one trigger ref is enough. Mobile now gains a delete entry point;
  // dailies are soft-deleted (Trash restore), so it is safe and matches desktop.
  const actionsMenu = (variant: "icon" | "boxed") => (
    <div className="relative shrink-0">
      <button
        ref={actionsTriggerRef}
        type="button"
        onClick={() => setActionsOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={actionsOpen}
        aria-label={t("materials.daily.moreActions")}
        className={cn(
          "grid shrink-0 place-items-center rounded-lumen-md",
          variant === "boxed"
            ? "h-8 w-8 border border-lumen-border bg-lumen-bg"
            : "h-7 w-7",
          "text-lumen-text-secondary hover:bg-lumen-hover hover:text-lumen-text",
          FOCUS_RING,
        )}
      >
        <MoreHorizontal size={variant === "boxed" ? 16 : 15} aria-hidden />
      </button>
      <Menu
        open={actionsOpen}
        onClose={() => setActionsOpen(false)}
        anchorRef={actionsTriggerRef}
        align="end"
        label={t("materials.daily.moreActions")}
      >
        <MenuItem
          icon={<Pin size={14} aria-hidden />}
          onSelect={() => {
            togglePin(selectedDate);
            setActionsOpen(false);
          }}
        >
          {selectedDaily?.isPinned
            ? t("materials.daily.unpin")
            : t("materials.daily.pin")}
        </MenuItem>
        <MenuItem
          icon={<Trash2 size={14} aria-hidden />}
          variant="danger"
          onSelect={() => {
            deleteDaily(selectedDate);
            setActionsOpen(false);
          }}
        >
          {t("materials.daily.delete")}
        </MenuItem>
      </Menu>
    </div>
  );

  /*
   * 夕刊カテゴリ (#1046) — under the body editor at both widths. Shown only
   * when the day has something to close on (a mood, a reflection, or any
   * schedule): an empty card under every blank past day would be noise, not
   * a look back. Copy for the stars and the all-day tag comes from the
   * briefing catalogue — they are the same concepts the papers name.
   */
  const showEveningCard =
    eveningStored.mood !== null ||
    eveningLines.length > 0 ||
    daySchedule.length > 0;
  const eveningCard = showEveningCard ? (
    <DailyEveningCard
      mood={eveningStored.mood}
      reflectionLines={eveningLines}
      schedule={daySchedule}
      labels={{
        title: t("materials.daily.eveningTitle"),
        moodStars: [1, 2, 3, 4, 5].map((n) =>
          t("briefing.evening.moodStar", { value: n }),
        ),
        scheduleTitle: t("materials.daily.eveningScheduleTitle"),
        allDay: t("briefing.allDay"),
      }}
    />
  ) : null;

  /*
   * Past entries — the detail panel's content at both widths (#876). Wide draws
   * it in the push-in rightSidebar; narrow draws the same nodes in the
   * hamburger's MobileDrawer, which mounts them only while it is open.
   *
   * Picking a day from here also CLOSES the drawer on narrow: it is a modal
   * overlay, so leaving it up would cover the entry it just opened. On wide the
   * panel is a pinned column and stays exactly where it was.
   */
  const selectDay = (date: string) => {
    setSelectedDate(date);
    if (!isWide) rightSidebar?.close();
  };
  const pastEntries = (
    <RightSidebarPortal>
      <div className="flex flex-col gap-2">
        {/* Sort mode + direction + filter (#283, modes added in #369),
            above the past-entries panel. */}
        <SidebarListControls
          modes={dailySortModes}
          activeModeId={dailySortMode}
          onModeChange={(id) => setDailySortMode(id as DailyListSortMode)}
          sortLabel={t("materials.sidebar.sort")}
          direction={dailySortDirection}
          onToggleDirection={() =>
            setDailySortDirection(
              dailySortDirection === "desc" ? "asc" : "desc",
            )
          }
          directionLabel={dailyDirectionLabel}
          directionToggleLabel={t("materials.sidebar.toggleDirection")}
          filter={{
            value: dailyFilterQuery,
            onChange: setDailyFilterQuery,
            placeholder: t("materials.daily.filterPlaceholder"),
            ariaLabel: t("materials.daily.filterLabel"),
          }}
        />
        <DailyEntriesPanel
          pickerDate={selectedDate}
          pickerLabel={selectedDate.replaceAll("-", "/")}
          datePickerLabel={t("materials.daily.datePicker")}
          onPickDate={selectDay}
          entriesHeading={t("materials.daily.entriesCount", {
            count: panelEntries.length,
          })}
          entries={panelEntries}
          onSelectEntry={selectDay}
          pinnedLabel={t("materials.daily.pinned")}
        />
      </div>
    </RightSidebarPortal>
  );

  // ---- Desktop --------------------------------------------------------

  if (isWide) {
    return (
      // PageContainer owns this tab's width + page gutter + scroll, so the
      // surface keeps only its own vertical rhythm + the editor's fill structure
      // — no width cap / gutter of its own. v2 §5 unifies materials to full width
      // (素の全幅): once #203 flips this tab from reading to full the editor spans
      // the gutter-padded full width. Until #203 merges it still renders in the
      // reading column.
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex justify-end pb-3">{toTodayButton}</div>
        <div className="flex min-h-0 flex-1 flex-col">
          <EditorCard
            dateLabel={fullDateLabel(selectedDate)}
            dateClassName="text-[28px] font-bold leading-tight tracking-tight text-lumen-text"
            savedLabel={savedLabel}
            headerActions={actionsMenu("icon")}
            editorKey={editorKey}
            date={selectedDate}
            initialContent={editorContent}
            onUpdate={handleEditorUpdate}
            placeholder={t("materials.daily.placeholder")}
            loadLinkTargets={loadLinkTargets}
            onNavigateToItem={onNavigateToItem}
            onResolvedLinkInserted={handleResolvedLinkInserted}
          />
          {eveningCard}
        </div>

        {pastEntries}
      </div>
    );
  }

  // ---- Mobile ---------------------------------------------------------

  return (
    <div className="flex h-full min-h-0 flex-col px-4 pt-2">
      <div className="flex items-center justify-end gap-2 pb-3">
        {toTodayButton}
        {actionsMenu("boxed")}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <EditorCard
          dateLabel={shortDateLabel(selectedDate)}
          dateClassName="text-lg font-bold leading-tight tracking-tight text-lumen-text"
          savedLabel={savedLabel}
          editorKey={editorKey}
          date={selectedDate}
          initialContent={editorContent}
          onUpdate={handleEditorUpdate}
          placeholder={t("materials.daily.placeholder")}
          loadLinkTargets={loadLinkTargets}
          onNavigateToItem={onNavigateToItem}
          onResolvedLinkInserted={handleResolvedLinkInserted}
        />
        {eveningCard}
      </div>

      {pastEntries}
    </div>
  );
}
