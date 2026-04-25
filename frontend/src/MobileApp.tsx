import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, BookOpen, StickyNote } from "lucide-react";
import { MobileLayout, type MobileTab } from "./components/Layout/MobileLayout";
import { MobileCalendarView } from "./components/Mobile/MobileCalendarView";
import { MobileWorkView } from "./components/Mobile/MobileWorkView";
import { MobileSettingsView } from "./components/Mobile/MobileSettingsView";
import { MobileLeftDrawer } from "./components/Mobile/shared/MobileLeftDrawer";
import { useEdgeSwipeBack } from "./components/Mobile/shared/useEdgeSwipeBack";
import { useSectionHistory } from "./hooks/useSectionHistory";
import { DailyView } from "./components/Ideas/DailyView";
import { NotesView } from "./components/Ideas/NotesView";
import { DailySidebar } from "./components/Ideas/DailySidebar";
import { MaterialsSidebar } from "./components/Ideas/MaterialsSidebar";
import { WorkSidebarInfo } from "./components/Work/WorkSidebarInfo";
import { useDailyContext } from "./hooks/useDailyContext";
import { useNoteContext } from "./hooks/useNoteContext";
import { useWikiTags } from "./hooks/useWikiTags";
import { useTemplateContext } from "./hooks/useTemplateContext";
import { useSidebarLinksContext } from "./hooks/useSidebarLinksContext";
import { useToast } from "./context/ToastContext";
import { SidebarLinkItem } from "./components/Layout/SidebarLinkItem";

type MaterialsSubTab = "daily" | "notes";

export function MobileApp() {
  const { t } = useTranslation();
  const history = useSectionHistory<MobileTab>("schedule");
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [materialsSubTab, setMaterialsSubTab] =
    useState<MaterialsSubTab>("notes");

  const { dailies, selectedDate, setSelectedDate, upsertDaily, deleteDaily } =
    useDailyContext();
  const {
    notes,
    flattenedNotes,
    expandedIds,
    toggleExpanded,
    selectedNoteId,
    setSelectedNoteId,
    createNote,
    createFolder,
    softDeleteNote,
    updateNote,
    persistWithHistory,
  } = useNoteContext();
  const { assignments, tags } = useWikiTags();
  const { getDefaultNoteContent, selectedTemplateId, setSelectedTemplateId } =
    useTemplateContext();
  const { links: sidebarLinks, openLink } = useSidebarLinksContext();
  const { showToast } = useToast();

  const handleTabChange = useCallback(
    (tab: MobileTab) => history.push(tab),
    [history],
  );
  const handleOpenDrawer = useCallback(() => setDrawerOpen(true), []);
  const handleCloseDrawer = useCallback(() => setDrawerOpen(false), []);

  useEdgeSwipeBack({
    enabled: history.canGoBack,
    onSwipeBack: history.goBack,
    isBlocked: () => isDrawerOpen,
  });

  const handleSelectDailyDate = useCallback(
    (date: string) => {
      setSelectedDate(date);
      setSelectedTemplateId(null);
      if (!dailies.some((d) => d.date === date)) upsertDaily(date, "");
      setDrawerOpen(false);
    },
    [dailies, setSelectedDate, upsertDaily, setSelectedTemplateId],
  );

  const handleSelectNote = useCallback(
    (noteId: string) => {
      setSelectedNoteId(noteId);
      setSelectedTemplateId(null);
      setDrawerOpen(false);
    },
    [setSelectedNoteId, setSelectedTemplateId],
  );

  const handleCreateNote = useCallback(() => {
    const initial = getDefaultNoteContent();
    const id = createNote(
      undefined,
      initial ? { initialContent: initial } : undefined,
    );
    setSelectedNoteId(id);
    setDrawerOpen(false);
  }, [createNote, setSelectedNoteId, getDefaultNoteContent]);

  const handleCreateNoteInFolder = useCallback(
    (parentId: string) => {
      const initial = getDefaultNoteContent();
      const id = createNote(undefined, {
        parentId,
        ...(initial ? { initialContent: initial } : {}),
      });
      setSelectedNoteId(id);
      if (!expandedIds.has(parentId)) toggleExpanded(parentId);
      setDrawerOpen(false);
    },
    [
      createNote,
      setSelectedNoteId,
      getDefaultNoteContent,
      expandedIds,
      toggleExpanded,
    ],
  );

  const handleCreateFolderInFolder = useCallback(
    (parentId: string) => {
      createFolder(undefined, parentId);
      if (!expandedIds.has(parentId)) toggleExpanded(parentId);
    },
    [createFolder, expandedIds, toggleExpanded],
  );

  const handleUpdateNoteTitle = useCallback(
    (noteId: string, title: string) => {
      updateNote(noteId, { title });
    },
    [updateNote],
  );

  const renderMain = () => {
    switch (history.current) {
      case "schedule":
        return <MobileCalendarView />;
      case "work":
        return <MobileWorkView />;
      case "materials":
        return materialsSubTab === "daily" ? <DailyView /> : <NotesView />;
      case "settings":
        return <MobileSettingsView />;
      default:
        return null;
    }
  };

  const renderDrawerSection = () => {
    switch (history.current) {
      case "materials":
        return (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 border-b border-notion-border">
              <button
                type="button"
                onClick={() => setMaterialsSubTab("daily")}
                className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium ${
                  materialsSubTab === "daily"
                    ? "border-b-2 border-notion-accent text-notion-accent"
                    : "text-notion-text-secondary"
                }`}
              >
                <BookOpen size={14} /> {t("mobile.tabs.daily", "Daily")}
              </button>
              <button
                type="button"
                onClick={() => setMaterialsSubTab("notes")}
                className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium ${
                  materialsSubTab === "notes"
                    ? "border-b-2 border-notion-accent text-notion-accent"
                    : "text-notion-text-secondary"
                }`}
              >
                <StickyNote size={14} /> {t("mobile.tabs.notes", "Notes")}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {materialsSubTab === "daily" ? (
                <DailySidebar
                  dailies={dailies}
                  assignments={assignments}
                  tags={tags}
                  selectedDate={selectedDate}
                  onSelectDate={handleSelectDailyDate}
                  onDeleteMemo={deleteDaily}
                  onSelectTemplate={setSelectedTemplateId}
                  selectedTemplateId={selectedTemplateId}
                />
              ) : (
                <MaterialsSidebar
                  notes={notes}
                  flattenedNotes={flattenedNotes}
                  expandedIds={expandedIds}
                  assignments={assignments}
                  tags={tags}
                  selectedNoteId={selectedNoteId}
                  onSelectNote={handleSelectNote}
                  onCreateNote={handleCreateNote}
                  onCreateFolder={createFolder}
                  onCreateNoteInFolder={handleCreateNoteInFolder}
                  onCreateFolderInFolder={handleCreateFolderInFolder}
                  onDeleteNote={softDeleteNote}
                  onUpdateNoteTitle={handleUpdateNoteTitle}
                  onToggleExpand={toggleExpanded}
                  persistWithHistory={persistWithHistory}
                  onSelectTemplate={setSelectedTemplateId}
                  selectedTemplateId={selectedTemplateId}
                />
              )}
            </div>
          </div>
        );
      case "work":
        return (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <WorkSidebarInfo />
          </div>
        );
      case "schedule":
      case "settings":
      default:
        return (
          <div className="px-4 py-6 text-sm text-notion-text-secondary">
            {t(
              "mobile.drawer.sectionContentEmpty",
              "No additional content for this section.",
            )}
          </div>
        );
    }
  };

  return (
    <>
      <MobileLayout
        activeTab={history.current}
        onTabChange={handleTabChange}
        onOpenDrawer={handleOpenDrawer}
      >
        {renderMain()}
      </MobileLayout>

      <MobileLeftDrawer isOpen={isDrawerOpen} onClose={handleCloseDrawer}>
        <div className="flex items-center justify-between border-b border-notion-border px-4 py-3">
          <h2 className="text-base font-semibold text-notion-text">
            {t("mobile.drawer.title", "Menu")}
          </h2>
          <button
            type="button"
            onClick={handleCloseDrawer}
            aria-label="Close"
            className="flex h-10 w-10 items-center justify-center text-notion-text-secondary active:bg-notion-hover active:text-notion-text"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          {renderDrawerSection()}
        </div>

        {sidebarLinks.length > 0 && (
          <div className="shrink-0 border-t border-notion-border px-2 py-2">
            <p className="px-2.5 pb-1 text-[10px] uppercase tracking-wider text-notion-text-secondary">
              {t("sidebarLinks.sectionTitle", "Links")}
            </p>
            <div className="space-y-0.5">
              {sidebarLinks.map((link) => (
                <SidebarLinkItem
                  key={link.id}
                  link={link}
                  iconSize={18}
                  textPx={14}
                  disabled={link.kind === "app"}
                  disabledReason={t(
                    "sidebarLinks.iosAppUnsupported",
                    "Apps cannot be launched on iOS",
                  )}
                  onClick={(l) => {
                    if (l.kind === "app") {
                      showToast(
                        "info",
                        t(
                          "sidebarLinks.iosAppUnsupported",
                          "Apps cannot be launched on iOS",
                        ),
                      );
                      return;
                    }
                    openLink(l)
                      .then(() => {
                        setDrawerOpen(false);
                      })
                      .catch(() => {
                        /* error logged in useSidebarLinks */
                      });
                  }}
                  onEdit={() => {
                    showToast(
                      "info",
                      t(
                        "sidebarLinks.editOnDesktop",
                        "Edit links from the desktop app",
                      ),
                    );
                  }}
                  onDelete={() => {
                    showToast(
                      "info",
                      t(
                        "sidebarLinks.editOnDesktop",
                        "Edit links from the desktop app",
                      ),
                    );
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </MobileLeftDrawer>
    </>
  );
}
