import type {
  ExtensionAppField,
  ExtensionAppIssue,
} from "../../types/extensionApp";

/*
 * The Apps section's shapes (#2165). Pure data: the host resolves every
 * string (§6.4) and owns every read and write (§3.1), so nothing here knows
 * about the DataService or `t`.
 */

/** One registered app joined with what its records say about it. */
export interface AppsListEntry {
  slug: string;
  name: string;
  url: string | null;
  icon: string | null;
  description: string | null;
  /** ISO instant of the newest record, or null when none arrived yet. */
  lastRecordAt: string | null;
  /** Records in the 30 days before the read (0 when none). */
  recordsLast30Days: number;
}

/**
 * A `source_app` the records carry that the ledger does not list — an app
 * whose gateway key sent records before anyone registered it here.
 */
export interface AppsUnregisteredSource {
  slug: string;
  lastRecordAt: string;
  recordsLast30Days: number;
}

/** What the register / edit dialog hands back. Text fields are trimmed. */
export interface AppFormValues {
  slug: string;
  name: string;
  url: string;
  icon: string | null;
  description: string;
}

/** A refusal for one field, from the client check or the service. */
export interface AppFormProblem {
  field: ExtensionAppField;
  issue: ExtensionAppIssue;
}

/**
 * The host's answer to a submit: null = saved (the dialog closes), problems =
 * mark those fields and stay open. Anything else (a network failure) should
 * reject; the dialog then shows `labels.dialog.saveFailed`.
 */
export type AppFormResult = AppFormProblem[] | null;

export interface AppCardLabels {
  /** "Last record: 3 days ago" — `days` is whole days since the record. */
  lastRecord: (days: number) => string;
  /** "12 in the last 30 days". */
  recordsLast30Days: (count: number) => string;
  /** Shown instead of the two lines above when nothing arrived yet. */
  noRecords: string;
  showRecords: string;
  edit: string;
  delete: string;
  /** Accessible name of the URL link: "Open {name}". */
  openUrl: (name: string) => string;
}

export interface AppRegisterDialogLabels {
  registerTitle: string;
  editTitle: string;
  slug: string;
  /** Under the slug field: it cannot change after registering, and why. */
  slugHint: string;
  name: string;
  url: string;
  urlPlaceholder: string;
  description: string;
  icon: {
    iconLabel: string;
    clearIconLabel: string;
    searchLabel: string;
    noMatchLabel: string;
    change: string;
  };
  save: string;
  cancel: string;
  saving: string;
  saveFailed: string;
  /** One line per refusal kind. */
  problems: Record<ExtensionAppIssue, string>;
}

export interface AppsViewLabels {
  heading: string;
  register: string;
  /** The empty state's paragraph on what this section is for. */
  emptyIntro: string;
  /**
   * How an app gets a key to send records (the procedure lives in PR #2194's
   * description). Shown in the empty state and under the list.
   */
  keyGuide: string;
  unregisteredHeading: string;
  unregisteredIntro: string;
  /** The button on an unregistered row. */
  registerSource: string;
  /** Read failed: say so rather than claiming there are no apps. */
  loadFailed: string;
  deleteConfirm: (name: string) => string;
  deleteConfirmLabel: string;
  deleteCancelLabel: string;
  deleteFailed: string;
  card: AppCardLabels;
  dialog: AppRegisterDialogLabels;
}
