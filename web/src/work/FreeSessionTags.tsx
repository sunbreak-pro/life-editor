import { useCallback, useState } from "react";
import {
  WorkTagSelector,
  generateId,
  useDomainLoad,
  useSyncDomains,
  useTimerContext,
  useTranslation,
  type DataService,
  type WikiTagUnified,
  type WorkTagOption,
} from "@life-editor/shared";

/*
 * Host for the free session's tag field (#1665). Sits to the right of the
 * link-target selector and decides which tags the Event the Provider mints
 * will carry.
 *
 * It talks to the DataService directly rather than to WikiTagsUnifiedContext:
 * that Provider is a SECTION-layer one (Materials / Schedule / Connect mount
 * it — rules/frontend.md §Provider 順序), and Work is not under it. The read
 * here is the tag master alone, which is what this field offers; assignments
 * are written later, by the Provider, against an item that does not exist yet.
 *
 * Selection itself lives on the TimerContext, not here: the Work screen
 * unmounts when the user walks to another section while the timer runs, and
 * the session that is still going has to keep the tags it was started with.
 */
export function FreeSessionTags({
  dataService: ds,
  disabled,
  sheet = false,
}: {
  dataService: DataService;
  disabled: boolean;
  /** Narrow face: open the picker as a BottomSheet (#1856). */
  sheet?: boolean;
}) {
  const { t } = useTranslation();
  const timer = useTimerContext();
  const [tags, setTags] = useState<WorkTagOption[]>([]);
  const version = useSyncDomains("tags");

  useDomainLoad<WikiTagUnified[]>({
    domain: "Free session tags",
    dataService: ds,
    version,
    // Creating a tag bumps `tags`, and a re-read must not blank the field.
    refetchReportsLoading: false,
    load: (service) => service.listAllWikiTagsUnified(),
    apply: (rows) =>
      setTags(
        rows
          .filter((tag) => !tag.isDeleted)
          .map((tag) => ({
            id: tag.id,
            name: tag.name,
            color: tag.color,
            icon: tag.icon,
          })),
      ),
    fallbackMessage: "Failed to load tags",
  });

  const handleCreate = useCallback(
    async (name: string): Promise<WorkTagOption> => {
      const created = await ds.createWikiTagUnified(
        generateId("tag"),
        name,
        null,
      );
      const option: WorkTagOption = {
        id: created.id,
        name: created.name,
        color: created.color,
        icon: created.icon,
      };
      // Locally too: the Realtime echo that would bring it back arrives after
      // the pill has to be on screen.
      setTags((prev) => [...prev, option]);
      return option;
    },
    [ds],
  );

  return (
    <WorkTagSelector
      tags={tags}
      selectedIds={timer.freeSessionTagIds}
      onChange={timer.setFreeSessionTagIds}
      onCreate={handleCreate}
      disabled={disabled}
      sheet={
        sheet ? { closeLabel: t("work.freeSession.tagSheetClose") } : undefined
      }
      labels={{
        heading: t("work.freeSession.tagHeading"),
        add: t("work.freeSession.tagAdd"),
        addShort: t("work.freeSession.tagAddShort"),
        search: t("work.freeSession.tagSearch"),
        create: (name: string) => t("work.freeSession.tagCreate", { name }),
        remove: (name: string) => t("work.freeSession.tagRemove", { name }),
        noCandidates: t("work.freeSession.tagNoCandidates"),
        dialog: t("work.freeSession.tagDialog"),
        disabledHint: t("work.freeSession.tagDisabled"),
      }}
    />
  );
}
