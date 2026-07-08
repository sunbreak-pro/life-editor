import { useMemo, useState, type ReactNode } from "react";
import { Calendar, Pin, Trash2 } from "lucide-react";
import {
  useDailiesUnifiedContext,
  useMediaQuery,
  useTranslation,
  RightSidebarPortal,
  DailyEntriesPanel,
  DateStrip,
  ExcerptListItem,
  cn,
  type DailyEntriesPanelEntry,
  type DateStripDay,
} from "@life-editor/shared";

/*
 * Web Daily tab (Materials mini-plan Step 4). Re-shaped to the target-IA
 * ClaudeDesign import:
 *
 *   - Desktop (isWide): a centered max-width 800px editor card (28px date
 *     heading + saved-state caption + pin / delete icon buttons + a plain-text
 *     body wired to upsertDaily-on-blur), a "今日へ" action row, and the past-
 *     entries UI PUSHED INTO THE SHARED rightSidebar via RightSidebarPortal +
 *     the new shared <DailyEntriesPanel> (today / yesterday jump, date picker,
 *     chronological entry list). The portal is rendered whenever wide — the
 *     panel is always-present content, not selection-driven.
 *   - Mobile (narrow): a "今日へ" + pin action row, a <DateStrip> of the last
 *     two weeks (entry-dot per day), the same editor card (19px date), and a
 *     "過去のエントリ" excerpt list of the two most recent other entries.
 *
 * The rich TipTap editor / password-lock / tags / links / trash subsystems the
 * old view carried are intentionally NOT part of this design (see the plan's
 * "デザイン → 実装のずれ" — the import shows a plain journal editor). Data stays
 * context-side (useDailiesUnifiedContext); this view is DataService-free (§3.1)
 * and takes all copy from useTranslation → props (§6.4). No hex — lumen-* only.
 */

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent";

function isoOf(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return isoOf(d);
}

function parseIso(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** First non-empty line of a plain-text body, for a one-line excerpt. */
function firstLine(content: string | undefined): string | undefined {
  if (!content) return undefined;
  const line = content
    .split("\n")
    .map((s) => s.trim())
    .find(Boolean);
  return line || undefined;
}

// ---- Editor card (shared between Desktop / Mobile, size via props) --------

function EditorCard({
  dateLabel,
  dateClassName,
  savedLabel,
  headerActions,
  draft,
  onDraftChange,
  onCommit,
  placeholder,
  bodyClassName,
}: {
  dateLabel: string;
  dateClassName: string;
  savedLabel: string;
  headerActions?: ReactNode;
  draft: string;
  onDraftChange: (value: string) => void;
  onCommit: () => void;
  placeholder: string;
  bodyClassName: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lumen-lg border border-lumen-border bg-lumen-surface shadow-lumen-sm">
      <div className="flex items-start gap-2.5 px-5 pb-1 pt-4">
        <h1 className={cn("flex-1", dateClassName)}>{dateLabel}</h1>
        <span className="pt-1.5 text-[11.5px] text-lumen-text-tertiary">
          {savedLabel}
        </span>
        {headerActions}
      </div>
      <textarea
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        onBlur={onCommit}
        placeholder={placeholder}
        className={cn(
          "min-h-0 flex-1 resize-none bg-transparent px-5 pb-5 pt-2 text-lumen-text",
          "placeholder:text-lumen-text-tertiary focus:outline-none",
          bodyClassName,
        )}
      />
    </div>
  );
}

export function DailyView() {
  const {
    dailies,
    selectedDate,
    setSelectedDate,
    selectedDaily,
    upsertDaily,
    deleteDaily,
    togglePin,
    getDailyForDate,
  } = useDailiesUnifiedContext();
  const { t, i18n } = useTranslation();
  const isWide = useMediaQuery("(min-width: 768px)", true);

  const isJa = i18n.language.startsWith("ja");
  const localeTag = isJa ? "ja-JP" : "en-US";
  const weekdayShort = useMemo(
    () => new Intl.DateTimeFormat(localeTag, { weekday: "short" }),
    [localeTag],
  );

  // Editable draft mirrors the selected daily's stored content. Resynced when
  // the selection changes OR when the persisted content for the current
  // selection changes (finishes loading / a refetch lands). "Adjust state
  // during render" (https://react.dev/learn/you-might-not-need-an-effect) —
  // avoids the cascading-render an effect-based prop→state sync causes.
  const [draft, setDraft] = useState(selectedDaily?.content ?? "");
  const [syncedFrom, setSyncedFrom] = useState<{
    date: string;
    content: string;
  }>({ date: selectedDate, content: selectedDaily?.content ?? "" });

  const selectedContent = selectedDaily?.content ?? "";
  if (
    syncedFrom.date !== selectedDate ||
    syncedFrom.content !== selectedContent
  ) {
    setSyncedFrom({ date: selectedDate, content: selectedContent });
    setDraft(selectedContent);
  }

  const isSaved = draft === selectedContent;
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
  const yesterdayIso = useMemo(() => isoDay(-1), []);

  const commit = () => upsertDaily(selectedDate, draft);

  // Chronological entries (newest first) for the rightSidebar panel + mobile.
  const sortedDailies = useMemo(
    () => [...dailies].sort((a, b) => b.date.localeCompare(a.date)),
    [dailies],
  );

  const panelEntries = useMemo<DailyEntriesPanelEntry[]>(
    () =>
      sortedDailies.map((d) => ({
        date: d.date,
        dayLabel: entryDayLabel(d.date),
        excerpt: firstLine(d.content),
        isPinned: d.isPinned,
        selected: d.date === selectedDate,
      })),
    // entryDayLabel depends only on locale (weekdayShort) — listed indirectly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortedDailies, selectedDate, weekdayShort],
  );

  // DateStrip window: the last 14 days, oldest → newest (today at the right).
  const stripDays = useMemo<DateStripDay[]>(() => {
    const arr: DateStripDay[] = [];
    for (let i = 13; i >= 0; i--) {
      const iso = isoDay(-i);
      const d = parseIso(iso);
      arr.push({
        date: iso,
        weekdayLabel: weekdayShort.format(d),
        dayLabel: `${d.getMonth() + 1}/${d.getDate()}`,
        hasEntry: !!getDailyForDate(iso),
      });
    }
    return arr;
    // dailies drives getDailyForDate's result (it reads a ref).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekdayShort, getDailyForDate, dailies]);

  const mobilePast = useMemo(
    () => sortedDailies.filter((d) => d.date !== selectedDate).slice(0, 2),
    [sortedDailies, selectedDate],
  );

  // "今日へ" accent CTA — jump the selection to today.
  const toTodayButton = (
    <button
      type="button"
      onClick={() => setSelectedDate(todayIso)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lumen-md bg-lumen-accent px-3.5 py-1.5",
        "text-[13px] font-medium text-lumen-on-accent shadow-lumen-sm transition-opacity hover:opacity-90",
        FOCUS_RING,
      )}
    >
      <Calendar size={14} aria-hidden />
      {t("materials.daily.toToday")}
    </button>
  );

  const pinButton = (variant: "icon" | "boxed") => (
    <button
      type="button"
      onClick={() => togglePin(selectedDate)}
      aria-pressed={selectedDaily?.isPinned ?? false}
      aria-label={
        selectedDaily?.isPinned
          ? t("materials.daily.unpin")
          : t("materials.daily.pin")
      }
      className={cn(
        "grid shrink-0 place-items-center rounded-lumen-md",
        variant === "boxed"
          ? "h-8 w-8 border border-lumen-border bg-lumen-bg"
          : "h-7 w-7",
        selectedDaily?.isPinned
          ? "bg-lumen-accent-subtle text-lumen-accent"
          : "text-lumen-text-secondary hover:bg-lumen-hover hover:text-lumen-text",
        FOCUS_RING,
      )}
    >
      <Pin size={14} aria-hidden />
    </button>
  );

  const deleteButton = (
    <button
      type="button"
      onClick={() => deleteDaily(selectedDate)}
      aria-label={t("materials.daily.delete")}
      className={cn(
        "grid h-7 w-7 shrink-0 place-items-center rounded-lumen-md text-lumen-text-secondary",
        "hover:bg-lumen-hover hover:text-lumen-danger",
        FOCUS_RING,
      )}
    >
      <Trash2 size={14} aria-hidden />
    </button>
  );

  // ---- Desktop --------------------------------------------------------

  if (isWide) {
    return (
      <div className="flex h-full min-h-0 flex-col px-7 pb-6 pt-5">
        <div className="mx-auto flex w-full max-w-[800px] justify-end pb-3">
          {toTodayButton}
        </div>
        <div className="mx-auto flex min-h-0 w-full max-w-[800px] flex-1 flex-col">
          <EditorCard
            dateLabel={fullDateLabel(selectedDate)}
            dateClassName="text-[28px] font-bold leading-tight tracking-tight text-lumen-text"
            savedLabel={savedLabel}
            headerActions={
              <div className="flex items-center gap-1">
                {pinButton("icon")}
                {deleteButton}
              </div>
            }
            draft={draft}
            onDraftChange={setDraft}
            onCommit={commit}
            placeholder={t("materials.daily.placeholder")}
            bodyClassName="text-[14.5px] leading-[1.85]"
          />
        </div>

        {/* Past entries — always-present content pushed into the shared
            rightSidebar (wide-only, so narrow never fills the MobileDrawer). */}
        <RightSidebarPortal>
          <DailyEntriesPanel
            todayLabel={t("materials.daily.today")}
            yesterdayLabel={t("materials.daily.yesterday")}
            todaySelected={selectedDate === todayIso}
            yesterdaySelected={selectedDate === yesterdayIso}
            onSelectToday={() => setSelectedDate(todayIso)}
            onSelectYesterday={() => setSelectedDate(yesterdayIso)}
            pickerDate={selectedDate}
            pickerLabel={selectedDate.replaceAll("-", "/")}
            datePickerLabel={t("materials.daily.datePicker")}
            onPickDate={setSelectedDate}
            entriesHeading={t("materials.daily.entriesCount", {
              count: sortedDailies.length,
            })}
            entries={panelEntries}
            onSelectEntry={setSelectedDate}
            pinnedLabel={t("materials.daily.pinned")}
          />
        </RightSidebarPortal>
      </div>
    );
  }

  // ---- Mobile ---------------------------------------------------------

  return (
    <div className="flex h-full min-h-0 flex-col px-4 pt-2">
      <div className="flex items-center justify-end gap-2 pb-3">
        {toTodayButton}
        {pinButton("boxed")}
      </div>

      <DateStrip
        days={stripDays}
        selectedDate={selectedDate}
        onSelect={setSelectedDate}
        label={t("materials.daily.dateStripLabel")}
        className="pb-3"
      />

      <div className="flex min-h-0 flex-1 flex-col">
        <EditorCard
          dateLabel={shortDateLabel(selectedDate)}
          dateClassName="text-[19px] font-bold leading-tight tracking-tight text-lumen-text"
          savedLabel={savedLabel}
          draft={draft}
          onDraftChange={setDraft}
          onCommit={commit}
          placeholder={t("materials.daily.placeholder")}
          bodyClassName="text-[14px] leading-[1.8]"
        />
      </div>

      {mobilePast.length > 0 && (
        <div className="flex flex-col gap-1.5 pb-4 pt-3">
          <div className="px-0.5 text-[11px] uppercase tracking-wide text-lumen-text-tertiary">
            {t("materials.daily.pastEntries")}
          </div>
          {mobilePast.map((d) => (
            <ExcerptListItem
              key={d.id}
              title={entryDayLabel(d.date)}
              excerpt={firstLine(d.content)}
              meta={
                d.isPinned ? (
                  <Pin
                    size={13}
                    aria-label={t("materials.daily.pinned")}
                    className="text-lumen-accent"
                  />
                ) : undefined
              }
              onClick={() => setSelectedDate(d.date)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
