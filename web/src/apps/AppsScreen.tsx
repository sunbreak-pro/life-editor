import { useCallback, useMemo, useState } from "react";
import {
  AppsView,
  ExtensionAppValidationError,
  useDomainLoad,
  useMediaQuery,
  useSyncDomains,
  useTranslation,
  WIDE_QUERY,
  type AppFormResult,
  type AppFormValues,
  type AppRecordSource,
  type AppsViewLabels,
  type DataService,
  type ExtensionApp,
} from "@life-editor/shared";

/*
 * Apps host (#2165). Same split as the Analytics and Trash hosts: this file
 * reads and writes through the injected DataService (§3.1 allows hosts) and
 * resolves `t`; the shared <AppsView> only draws.
 *
 * Two reads, both on the sync domains they come from (rules/frontend.md
 * §Sync): the ledger (`extensionApps`) and the per-app record activity
 * (`appRecords`). A gateway key that sends its first record therefore makes
 * the app appear under "apps that only sent records" without a reload.
 *
 * Writes also patch the local list straight away. Realtime echoes them back
 * and the re-read lands the same rows, but the dialog closes on the write's
 * answer, and the card should already be there when it does.
 */

interface AppsScreenProps {
  dataService: DataService;
  /** Open Analytics' Records tab filtered to this app (useShellNavigation). */
  onShowRecords: (slug: string) => void;
}

interface AppsData {
  apps: ExtensionApp[];
  sources: AppRecordSource[];
}

const EMPTY: AppsData = { apps: [], sources: [] };

/** Turn the dialog's trimmed strings into the ledger's nullable fields. */
function toNullable(value: string): string | null {
  return value === "" ? null : value;
}

/** A service refusal as the dialog's field problem; anything else rethrows. */
function asProblems(err: unknown): AppFormResult {
  if (err instanceof ExtensionAppValidationError)
    return [{ field: err.field, issue: err.issue }];
  throw err;
}

export function AppsScreen({
  dataService: ds,
  onShowRecords,
}: AppsScreenProps): React.JSX.Element {
  const { t } = useTranslation();
  const isWide = useMediaQuery(WIDE_QUERY, true);
  const syncVersion = useSyncDomains("extensionApps", "appRecords");
  const [data, setData] = useState<AppsData>(EMPTY);

  const { isLoading, error } = useDomainLoad<AppsData>({
    domain: "Apps",
    dataService: ds,
    version: syncVersion,
    load: async (service) => {
      const [apps, sources] = await Promise.all([
        service.listExtensionApps(),
        service.listAppRecordSources(),
      ]);
      return { apps, sources };
    },
    apply: setData,
    fallbackMessage: "Failed to load apps",
    // A re-read after a write keeps the list on screen instead of a skeleton.
    refetchReportsLoading: false,
  });

  const register = useCallback(
    async (values: AppFormValues): Promise<AppFormResult> => {
      try {
        const created = await ds.createExtensionApp({
          slug: values.slug,
          name: values.name,
          url: toNullable(values.url),
          icon: values.icon,
          description: toNullable(values.description),
        });
        setData((prev) => ({
          ...prev,
          apps: [...prev.apps.filter((a) => a.slug !== created.slug), created],
        }));
        return null;
      } catch (err) {
        return asProblems(err);
      }
    },
    [ds],
  );

  const update = useCallback(
    async (slug: string, values: AppFormValues): Promise<AppFormResult> => {
      try {
        const updated = await ds.updateExtensionApp(slug, {
          name: values.name,
          url: toNullable(values.url),
          icon: values.icon,
          description: toNullable(values.description),
        });
        setData((prev) => ({
          ...prev,
          apps: prev.apps.map((a) => (a.slug === slug ? updated : a)),
        }));
        return null;
      } catch (err) {
        return asProblems(err);
      }
    },
    [ds],
  );

  const remove = useCallback(
    async (slug: string): Promise<void> => {
      await ds.deleteExtensionApp(slug);
      setData((prev) => ({
        ...prev,
        apps: prev.apps.filter((a) => a.slug !== slug),
      }));
    },
    [ds],
  );

  const labels: AppsViewLabels = useMemo(
    () => ({
      heading: t("apps.heading"),
      register: t("apps.register"),
      emptyIntro: t("apps.emptyIntro"),
      keyGuide: t("apps.keyGuide"),
      unregisteredHeading: t("apps.unregisteredHeading"),
      unregisteredIntro: t("apps.unregisteredIntro"),
      registerSource: t("apps.registerSource"),
      loadFailed: t("apps.loadFailed"),
      deleteConfirm: (name) => t("apps.deleteConfirm", { name }),
      deleteConfirmLabel: t("apps.deleteConfirmLabel"),
      deleteCancelLabel: t("apps.deleteCancelLabel"),
      deleteFailed: t("apps.deleteFailed"),
      card: {
        lastRecord: (days) =>
          days === 0
            ? t("apps.card.lastRecordToday")
            : t("apps.card.lastRecord", { count: days }),
        recordsLast30Days: (count) =>
          t("apps.card.recordsLast30Days", { count }),
        noRecords: t("apps.card.noRecords"),
        showRecords: t("apps.card.showRecords"),
        edit: t("apps.card.edit"),
        delete: t("apps.card.delete"),
        openUrl: (name) => t("apps.card.openUrl", { name }),
      },
      dialog: {
        registerTitle: t("apps.dialog.registerTitle"),
        editTitle: t("apps.dialog.editTitle"),
        slug: t("apps.dialog.slug"),
        slugHint: t("apps.dialog.slugHint"),
        name: t("apps.dialog.name"),
        url: t("apps.dialog.url"),
        urlPlaceholder: t("apps.dialog.urlPlaceholder"),
        description: t("apps.dialog.description"),
        icon: {
          iconLabel: t("apps.dialog.iconLabel"),
          clearIconLabel: t("apps.dialog.iconClear"),
          searchLabel: t("apps.dialog.iconSearch"),
          noMatchLabel: t("apps.dialog.iconNoMatch"),
          change: t("apps.dialog.iconChange"),
        },
        save: t("apps.dialog.save"),
        cancel: t("apps.dialog.cancel"),
        saving: t("apps.dialog.saving"),
        saveFailed: t("apps.dialog.saveFailed"),
        problems: {
          empty: t("apps.dialog.problems.empty"),
          badSlug: t("apps.dialog.problems.badSlug"),
          badUrl: t("apps.dialog.problems.badUrl"),
          taken: t("apps.dialog.problems.taken"),
        },
      },
    }),
    [t],
  );

  return (
    <AppsView
      apps={data.apps}
      sources={data.sources}
      loading={isLoading}
      loadFailed={error != null}
      canManage={isWide}
      labels={labels}
      onShowRecords={onShowRecords}
      onRegister={register}
      onUpdate={update}
      onDelete={remove}
    />
  );
}
