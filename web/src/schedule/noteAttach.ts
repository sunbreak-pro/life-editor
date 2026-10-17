import {
  useTranslation,
  type ItemCreateNoteDraft,
  type ItemCreateOption,
  type ItemNoteAttachLabels,
} from "@life-editor/shared";

/*
 * 「ノートを添付」 on an existing item (#2219) — what the two edit panels
 * (ScheduleEventEditor / ScheduleTodoDetail) need from their host, and the
 * words they both show.
 *
 * The pool and the write are the create panel's (useCreatePanelNotes), so a
 * note attached from an edit panel is made and linked exactly as one staged in
 * the create panel is — the item → note link DailyView uses too.
 */

export interface ScheduleNoteAttach {
  notes: ItemCreateOption[];
  /** The list could not be read — the picker says so instead of "no notes". */
  notesError?: boolean;
  /** Create the note if it is new, then link it to `itemId`. */
  onAttach: (itemId: string, draft: ItemCreateNoteDraft) => void;
  /**
   * The picker opened or closed. The host reads the note list only while it
   * is open — the same rule the create panel's own `active` follows.
   */
  onOpenChange?: (open: boolean) => void;
}

/** The attach control's words (§6.4: resolved on the host side). */
export function useNoteAttachLabels(notesError = false): ItemNoteAttachLabels {
  const { t } = useTranslation();
  return {
    attachNote: t("scheduleScreen.attachNote"),
    noteSourceLabel: t("scheduleScreen.noteSourceLabel"),
    noteSourceNew: t("scheduleScreen.noteSourceNew"),
    noteSourceExisting: t("scheduleScreen.noteSourceExisting"),
    noteTitleLabel: t("scheduleScreen.noteTitleLabel"),
    notePlaceholder: t("scheduleScreen.notePlaceholder"),
    searchNotes: t("scheduleScreen.searchNotes"),
    notePickerEmpty: notesError
      ? t("scheduleScreen.notePickerError")
      : t("scheduleScreen.notePickerEmpty"),
    notePickerNoMatch: t("scheduleScreen.notePickerNoMatch"),
    attach: t("scheduleScreen.noteAttachConfirm"),
    attachedNote: t("scheduleScreen.attachedNote"),
  };
}
