import { useCallback, useEffect, useMemo, useState } from "react";
import {
  resolveInitialSection,
  persistLastSection,
  defaultBriefingTab,
  type BriefingTab,
  type AnalyticsTab,
  type SectionId,
  type NavShortcutId,
} from "@life-editor/shared";

/*
 * Navigation half of the app-shell host (extracted from MainScreen.tsx —
 * hooks split, zero behavior change): the section switch (a local
 * `useState`, no React Router — CLAUDE.md §3.2), the in-section tab states
 * lifted so the standard SectionHeader can render each band, and the
 * pending-intent idiom (new-todo flag / "[[" item-nav stash) that the
 * destination views consume on mount.
 */

/** In-Materials tab — the document surfaces addressed by one section. */
export type MaterialsTab = "notes" | "daily";

/**
 * A navigation destination in the CURRENT information architecture (#676 (b)):
 * the section to switch to, plus the in-section tab for the two sections that
 * have one. Every navigation intent — a nav:* shortcut, a Briefing jump, a
 * "[[" link click — speaks this one vocabulary now. It replaces the shared
 * `NavSection` union ("todos" / "daily" / "notes" / "tags"), which named the
 * flat pre-2026-07 sections and so had to be re-translated by hand at each
 * call site.
 */
export type NavDestination =
  | { section: "materials"; tab: MaterialsTab }
  // Schedule lost its tab arm in #1153: the section is one surface again, and
  // its todo tray is a sidebar tab the section itself owns. What used to be
  // "which tab" is now an INTENT the section consumes (pendingTodoTray /
  // pendingNewTodo / pendingItemNav), because a right-hand drawer is not
  // addressable from out here.
  | { section: Exclude<SectionId, "materials"> };

/**
 * Where each nav:* binding lands. The shared executor only reports WHICH
 * binding fired (§ useGlobalShortcuts) — the IA lives here, in one table.
 */
const NAV_SHORTCUT_DESTINATION: Readonly<
  Record<NavShortcutId, NavDestination | null>
> = {
  // Both land on Schedule since #1153, and they are NOT the same press:
  // nav:tasks also raises `pendingTodoTray` (see handleNavigate), which is what
  // still makes it mean "my todos" rather than "the calendar".
  "nav:tasks": { section: "schedule" },
  "nav:schedule": { section: "schedule" },
  "nav:daily": { section: "materials", tab: "daily" },
  "nav:notes": { section: "materials", tab: "notes" },
  // The Tags tab was retired (#310) and nothing took its place, so this
  // binding has nowhere to land. Declared as an explicit null rather than
  // left as a silent fall-through inside the handler (#676 (b)).
  "nav:tags": null,
};

/**
 * Where a "[[" link target opens (#285; todos added in #370, and moved from
 * Materials to Schedule in #411 — hence a section+tab pair rather than a bare
 * Materials tab). A role absent here has no selectable surface yet, so its
 * link click no-ops.
 */
const ITEM_NAV_TARGET: Record<string, NavDestination | undefined> = {
  note: { section: "materials", tab: "notes" },
  daily: { section: "materials", tab: "daily" },
  task: { section: "schedule" },
  // Events joined in #503 (palette search). They are NOT offered by the "[["
  // autocomplete — that pool is built separately (useItemLinkTargets) — so
  // this route is reached from the palette only, for now.
  event: { section: "schedule" },
};

/**
 * The navigation half's public surface. Section descriptors take the whole
 * object (`SectionBodyContext.nav`) rather than a dozen individually-drilled
 * props, so adding a section body needs no new plumbing here.
 */
export type ShellNavigation = ReturnType<typeof useShellNavigation>;

export interface ShellNavigationOptions {
  /**
   * #753: asked before the section changes, because a section change unmounts
   * the whole body — draft and all — and the panel inside has no way to see it
   * coming. Resolves `true` when navigation may go ahead (nothing pending, or
   * the user agreed to discard it). Omit and every navigation goes straight
   * through, exactly as before.
   */
  confirmLeave?: () => Promise<boolean>;
}

export function useShellNavigation({
  confirmLeave,
}: ShellNavigationOptions = {}) {
  // Startup section (§216): resolve the initial section from the user's
  // preference (resume last-visited / a fixed section), falling back to the
  // default. Lazy init so the localStorage read runs once.
  const [section, setSectionNow] = useState<SectionId>(() =>
    resolveInitialSection(),
  );
  const [materialsTab, setMaterialsTab] = useState<MaterialsTab>("notes");
  // Analytics's Overview/Todos/Work/Schedule tab, lifted here (v2 adoption
  // #208) so the standard SectionHeader renders the band — same tabs-as-title
  // pattern as materialsTab.
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>("overview");
  // Briefing's 朝刊/夕刊 tab (#263 F-6), lifted here so the standard
  // SectionHeader renders the band — same tabs-as-title pattern as
  // materialsTab. Lazy init: the initial tab follows the clock
  // (evening from 17:00, honoring the day-start pref's post-midnight tail).
  const [briefingTab, setBriefingTab] = useState<BriefingTab>(() =>
    defaultBriefingTab(),
  );
  // global:new-task intent, consumed once by the Schedule section (see
  // handleNewTodo). A boolean "pending" flag — not a nonce — so returning to
  // the section later never re-opens the add dialog.
  const [pendingNewTodo, setPendingNewTodo] = useState(false);
  /*
   * nav:tasks intent (#1153). "Go to my todos" used to be a tab switch; the
   * tray it now means is a sidebar tab the Schedule section owns, so the shell
   * asks rather than sets. Same consume-once flag shape as pendingNewTodo —
   * without it, arriving at Schedule by any other route would keep re-opening
   * the drawer.
   */
  const [pendingTodoTray, setPendingTodoTray] = useState(false);

  // Startup section (§216): remember the last-visited section so the "resume"
  // startup preference can restore it on the next launch. Writes on every
  // section change (localStorage only — no re-render).
  useEffect(() => {
    persistLastSection(section);
  }, [section]);

  /*
   * #753: the one gate every navigation passes through. Leaving a section
   * tears its body down, so a pending draft has to be asked about first — and
   * asking is asynchronous (the answer is an in-app dialog), which is why the
   * move itself is handed in as a callback rather than returned as a verdict.
   *
   * Without a `confirmLeave` this is a plain call, so the hook keeps working
   * unchanged for any host that does not mount the guard.
   */
  const guarded = useCallback(
    (move: () => void) => {
      if (!confirmLeave) {
        move();
        return;
      }
      void confirmLeave().then((ok) => {
        if (ok) move();
      });
    },
    [confirmLeave],
  );

  // The one place a destination is applied. Everything that navigates — the
  // nav:* shortcuts, Briefing's jump links, "[[" link clicks — routes through
  // here, so section and tab can never be set out of step. Unguarded: the
  // public entry points below are what ask.
  const applyDestination = useCallback((dest: NavDestination) => {
    setSectionNow(dest.section);
    if (dest.section === "materials") setMaterialsTab(dest.tab);
  }, []);

  const navigateTo = useCallback(
    (dest: NavDestination) => guarded(() => applyDestination(dest)),
    [guarded, applyDestination],
  );

  /*
   * The bare section switch (nav rail, bottom bar, palette commands). Not the
   * raw setState any more, so it takes a section id rather than a React
   * updater — every caller already passed one.
   */
  const setSection = useCallback(
    (next: SectionId) => guarded(() => setSectionNow(next)),
    [guarded],
  );

  // nav:* shortcut executor. The shared hook reports which binding fired; the
  // table above says where it lands (null = a retired binding, no-op).
  const handleNavigate = useCallback(
    (id: NavShortcutId) => {
      const dest = NAV_SHORTCUT_DESTINATION[id];
      if (!dest) return;
      // #1153: nav:tasks and nav:schedule now share a destination, so the
      // intent is what tells them apart. Raised INSIDE the guard for the same
      // reason handleNewTodo does it — a refused navigation must not leave a
      // flag that opens the tray on the user's next visit.
      guarded(() => {
        applyDestination(dest);
        if (id === "nav:tasks") setPendingTodoTray(true);
      });
    },
    [applyDestination, guarded],
  );

  // global:new-task executor. Todo creation lives behind the TodoTree
  // Provider, which only the Schedule section mounts, so the shell can't call
  // the create API directly. Instead it navigates to Schedule and raises a
  // "pending new todo" flag; the section consumes it, opens the todo tray and
  // its create dialog (which auto-focuses the title input and creates the todo
  // on submit). That is the app's own create-and-focus entry — no new
  // DataService API, no title-less junk rows.
  //
  // #753: the intent and the move are raised together INSIDE the guard — a
  // refused navigation that still set the flag would open the create dialog
  // the next time the user went to Todos of their own accord.
  const handleNewTodo = useCallback(() => {
    guarded(() => {
      applyDestination({ section: "schedule" });
      setPendingNewTodo(true);
    });
  }, [guarded, applyDestination]);
  // The Schedule section calls this once it has acted on the flag.
  const consumeNewTodo = useCallback(() => setPendingNewTodo(false), []);
  const consumeTodoTray = useCallback(() => setPendingTodoTray(false), []);

  // "[[" wiki-link navigation (Issue #285). A resolved link click in the Notes
  // or Daily editor routes here; the shell owns the section + tab switch (the
  // target view lives behind a different domain Provider), then stashes a
  // pending selection the destination view consumes on mount — the same idiom
  // as pendingNewTodo. Todos joined note / daily in #370; since #1153 a task
  // lands on Schedule and opens the todo DETAIL overlay rather than a tab (the
  // tab is retired). Any other role has no selectable surface yet, so it
  // no-ops.
  const [pendingItemNav, setPendingItemNav] = useState<{
    id: string;
    role: string;
    date?: string;
  } | null>(null);
  const navigateToItem = useCallback(
    (target: { id: string; role: string; date?: string }) => {
      const dest = ITEM_NAV_TARGET[target.role];
      if (!dest) return;
      // Stashed inside the guard, like handleNewTodo: a refused jump must not
      // leave a pending selection waiting to fire on the next visit.
      guarded(() => {
        applyDestination(dest);
        setPendingItemNav(target);
      });
    },
    [guarded, applyDestination],
  );
  const consumeItemNav = useCallback(() => setPendingItemNav(null), []);
  const pendingNoteSelect =
    pendingItemNav?.role === "note" ? pendingItemNav.id : null;
  const pendingDailySelect =
    pendingItemNav?.role === "daily"
      ? pendingItemNav.id.replace(/^daily-/, "")
      : null;
  const pendingTodoSelect =
    pendingItemNav?.role === "task" ? pendingItemNav.id : null;
  /*
   * An event carries its DATE alongside its id (#503), unlike the other three.
   * The Calendar shows one window at a time and its navigation does not fetch
   * outside it, so selecting the id alone would highlight a row on whatever
   * week happens to be open — i.e. nothing. The searcher already knows the
   * date (it is on the row the user clicked), so it travels with the intent
   * rather than costing the Calendar a lookup on mount.
   */
  // Memoised because it is an OBJECT, unlike its three string siblings: the
  // consumer keys an effect on it, and a fresh identity every render would
  // re-fire that effect for as long as the intent is up.
  const pendingEventSelect = useMemo(
    () =>
      pendingItemNav?.role === "event" && pendingItemNav.date
        ? { id: pendingItemNav.id, date: pendingItemNav.date }
        : null,
    [pendingItemNav],
  );

  return {
    section,
    setSection,
    materialsTab,
    setMaterialsTab,
    pendingTodoTray,
    consumeTodoTray,
    analyticsTab,
    setAnalyticsTab,
    briefingTab,
    setBriefingTab,
    pendingNewTodo,
    consumeNewTodo,
    navigateTo,
    handleNavigate,
    handleNewTodo,
    navigateToItem,
    consumeItemNav,
    pendingNoteSelect,
    pendingDailySelect,
    pendingTodoSelect,
    pendingEventSelect,
  };
}
