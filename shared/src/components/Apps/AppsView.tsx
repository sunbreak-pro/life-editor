import { useId, useMemo, useState } from "react";
import { Blocks, Plus } from "lucide-react";
import { Button } from "../Button";
import { ConfirmDialog, useConfirmDialog } from "../ConfirmDialog";
import { CARD_BTN_TAP } from "../styleTokens";
import type { AppRecordSource } from "../../types/appRecord";
import type { ExtensionApp } from "../../types/extensionApp";
import { AppCard } from "./AppCard";
import { AppRegisterDialog } from "./AppRegisterDialog";
import { buildAppsModel, daysSince } from "./appsModel";
import type { AppFormResult, AppFormValues, AppsViewLabels } from "./types";

/*
 * The Apps section body (#2165): register extension apps, list them with what
 * their records say, and pick up apps whose records arrived before anyone
 * registered them.
 *
 * Pure (§3.1 / §6.4): the host reads the ledger and the record sources, owns
 * every write, and passes translated labels. What lives here is the screen's
 * own state — which dialog is open, and the delete question.
 *
 * Deleting removes the LEDGER row only. The app's records stay (0039 — no FK
 * from `source_app`), so a deleted app with records drops straight back into
 * "apps that only sent records", where it can be registered again.
 */

export interface AppsViewProps {
  apps: readonly ExtensionApp[];
  sources: readonly AppRecordSource[];
  /** True until the first read settles (draws a skeleton, not "no apps"). */
  loading: boolean;
  /** The read failed: say so instead of the empty state. */
  loadFailed: boolean;
  /**
   * Register / edit / delete are offered. False on the narrow layout, which
   * lists and opens apps but leaves the ledger alone (Phase 1 —
   * mobile-scope.md row 21).
   */
  canManage: boolean;
  labels: AppsViewLabels;
  /** Epoch ms the "n days ago" lines count from. Defaults to the render time. */
  now?: number;
  onShowRecords: (slug: string) => void;
  onRegister: (values: AppFormValues) => Promise<AppFormResult>;
  onUpdate: (slug: string, values: AppFormValues) => Promise<AppFormResult>;
  /** Rejects when the delete did not go through. */
  onDelete: (slug: string) => Promise<void>;
}

interface DialogState {
  mode: "register" | "edit";
  initial: AppFormValues;
  /** Remounts the form, so each opening starts from `initial`. */
  key: number;
}

const BLANK_FORM: AppFormValues = {
  slug: "",
  name: "",
  url: "",
  icon: null,
  description: "",
};

export function AppsView({
  apps,
  sources,
  loading,
  loadFailed,
  canManage,
  labels,
  now,
  onShowRecords,
  onRegister,
  onUpdate,
  onDelete,
}: AppsViewProps) {
  const model = useMemo(() => buildAppsModel(apps, sources), [apps, sources]);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const confirm = useConfirmDialog();
  // Taken once at mount: a list read a minute ago needs no ticking clock.
  const [mountedAt] = useState(() => Date.now());
  const at = now ?? mountedAt;
  const unregisteredHeadingId = useId();

  const openDialog = (
    mode: DialogState["mode"],
    initial: AppFormValues,
  ): void => {
    setDialog((prev) => ({ mode, initial, key: (prev?.key ?? 0) + 1 }));
  };

  const openRegister = (slug = ""): void =>
    openDialog("register", { ...BLANK_FORM, slug });

  const openEdit = (slug: string): void => {
    const app = apps.find((a) => a.slug === slug);
    if (!app) return;
    openDialog("edit", {
      slug: app.slug,
      name: app.name,
      url: app.url ?? "",
      icon: app.icon,
      description: app.description ?? "",
    });
  };

  const closeDialog = (): void => setDialog(null);

  const submit = async (values: AppFormValues): Promise<AppFormResult> => {
    if (!dialog) return null;
    const result =
      dialog.mode === "register"
        ? await onRegister(values)
        : await onUpdate(dialog.initial.slug, values);
    if (!result || result.length === 0) setDialog(null);
    return result;
  };

  const askDelete = (slug: string): void => {
    const app = apps.find((a) => a.slug === slug);
    if (!app) return;
    setDeleteFailed(false);
    void confirm
      .ask({
        message: labels.deleteConfirm(app.name),
        confirmLabel: labels.deleteConfirmLabel,
        cancelLabel: labels.deleteCancelLabel,
        danger: true,
      })
      .then((yes) => {
        if (!yes) return;
        onDelete(slug).catch(() => setDeleteFailed(true));
      });
  };

  const isEmpty =
    !loading &&
    !loadFailed &&
    model.registered.length === 0 &&
    model.unregistered.length === 0;

  return (
    <div className="flex flex-col gap-6 py-4">
      {/* Not while loading: the read may come back empty, and the empty state
          carries its own button — showing this one first made it blink away. */}
      {canManage && !loading && !isEmpty && (
        <div className="flex justify-end">
          <Button
            variant="primary"
            size="sm"
            className={CARD_BTN_TAP}
            leadingIcon={<Plus size={14} />}
            onClick={() => openRegister()}
          >
            {labels.register}
          </Button>
        </div>
      )}

      {loadFailed && (
        <p role="alert" className="text-sm text-lumen-danger">
          {labels.loadFailed}
        </p>
      )}
      {deleteFailed && (
        <p role="alert" className="text-sm text-lumen-danger">
          {labels.deleteFailed}
        </p>
      )}

      {loading && model.registered.length === 0 && (
        <div aria-hidden="true" className="grid gap-3 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-lg bg-lumen-bg-secondary motion-reduce:animate-none"
            />
          ))}
        </div>
      )}

      {isEmpty && (
        <div className="mx-auto flex max-w-lg flex-col items-center gap-3 px-2 py-10 text-center">
          <Blocks
            size={28}
            aria-hidden="true"
            className="text-lumen-text-tertiary"
          />
          <p className="text-sm leading-relaxed text-lumen-text-secondary">
            {labels.emptyIntro}
          </p>
          {canManage && (
            <Button
              variant="primary"
              size="sm"
              className={CARD_BTN_TAP}
              leadingIcon={<Plus size={14} />}
              onClick={() => openRegister()}
            >
              {labels.register}
            </Button>
          )}
          <p className="text-xs leading-relaxed text-lumen-text-tertiary">
            {labels.keyGuide}
          </p>
        </div>
      )}

      {model.registered.length > 0 && (
        <ul aria-label={labels.heading} className="grid gap-3 sm:grid-cols-2">
          {model.registered.map((app) => (
            <li key={app.slug} className="min-w-0">
              <AppCard
                app={app}
                labels={labels.card}
                now={at}
                onShowRecords={onShowRecords}
                onEdit={canManage ? openEdit : undefined}
                onDelete={canManage ? askDelete : undefined}
              />
            </li>
          ))}
        </ul>
      )}

      {model.unregistered.length > 0 && (
        <section
          aria-labelledby={unregisteredHeadingId}
          className="flex flex-col gap-2"
        >
          <h3
            id={unregisteredHeadingId}
            className="text-sm font-medium text-lumen-text"
          >
            {labels.unregisteredHeading}
          </h3>
          <p className="text-xs leading-relaxed text-lumen-text-secondary">
            {labels.unregisteredIntro}
          </p>
          <ul className="flex flex-col divide-y divide-lumen-border rounded-lg border border-lumen-border bg-lumen-bg">
            {model.unregistered.map((source) => (
              <li
                key={source.slug}
                data-unregistered-slug={source.slug}
                className="flex items-center gap-3 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-lumen-text">
                    {source.slug}
                  </p>
                  <p className="text-xs tabular-nums text-lumen-text-secondary">
                    {`${labels.card.lastRecord(daysSince(source.lastRecordAt, at))} · ${labels.card.recordsLast30Days(source.recordsLast30Days)}`}
                  </p>
                </div>
                {canManage && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className={CARD_BTN_TAP}
                    onClick={() => openRegister(source.slug)}
                  >
                    {labels.registerSource}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!isEmpty && !loading && (
        <p className="text-xs leading-relaxed text-lumen-text-tertiary">
          {labels.keyGuide}
        </p>
      )}

      {dialog && (
        <AppRegisterDialog
          key={dialog.key}
          open
          mode={dialog.mode}
          initial={dialog.initial}
          labels={labels.dialog}
          onSubmit={submit}
          onClose={closeDialog}
        />
      )}

      <ConfirmDialog
        open={confirm.request != null}
        message={confirm.request?.message ?? ""}
        confirmLabel={confirm.request?.confirmLabel ?? ""}
        cancelLabel={confirm.request?.cancelLabel}
        danger={confirm.request?.danger}
        onConfirm={() => confirm.resolve(true)}
        onCancel={() => confirm.resolve(false)}
      />
    </div>
  );
}
