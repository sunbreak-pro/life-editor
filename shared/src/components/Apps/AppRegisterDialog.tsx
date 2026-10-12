import { useId, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "../Button";
import { Input } from "../Input";
import { Modal } from "../Modal";
import { CARD_BTN_TAP, FIELD, FIELD_LABEL } from "../styleTokens";
import { TagIconPicker } from "../TagHub/TagIconPicker";
import { extensionAppProblems } from "../../services/appRecordMapper";
import { isImeComposing } from "../../utils/imeGuard";
import type { ExtensionAppField } from "../../types/extensionApp";
import type {
  AppFormProblem,
  AppFormResult,
  AppFormValues,
  AppRegisterDialogLabels,
} from "./types";

/*
 * Register / edit one extension app (#2165).
 *
 * The slug is typed once and then frozen: `app_records.source_app` and the
 * gateway key (#2146) both point at it, so renaming it would orphan every
 * record the app already sent. Edit mode therefore shows it read-only.
 *
 * Fields are checked here with the same function the service runs
 * (`extensionAppProblems`) so a bad slug or URL is marked before any request.
 * The service still has the last word — only it can know a slug is `taken` —
 * and its refusals come back through `onSubmit` in the same shape.
 *
 * The form mounts fresh each time the dialog opens (the parent keys it), so
 * its state is plain `useState` seeded from `initial` with no sync effect.
 */

export interface AppRegisterDialogProps {
  open: boolean;
  mode: "register" | "edit";
  /** Seed values: an empty form, a slug picked up from records, or the app. */
  initial: AppFormValues;
  labels: AppRegisterDialogLabels;
  onSubmit: (values: AppFormValues) => Promise<AppFormResult>;
  onClose: () => void;
}

export function AppRegisterDialog(props: AppRegisterDialogProps) {
  const { open, mode, labels, onClose } = props;
  const titleId = useId();
  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      size="md"
      fitViewport
      closeLabel={labels.cancel}
    >
      <h2 id={titleId} className="mb-3 text-base font-medium text-lumen-text">
        {mode === "register" ? labels.registerTitle : labels.editTitle}
      </h2>
      {open && <AppForm {...props} />}
    </Modal>
  );
}

function AppForm({
  mode,
  initial,
  labels,
  onSubmit,
  onClose,
}: AppRegisterDialogProps) {
  const [values, setValues] = useState<AppFormValues>(initial);
  const [problems, setProblems] = useState<AppFormProblem[]>([]);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const ids = {
    slug: useId(),
    name: useId(),
    url: useId(),
    description: useId(),
  };

  const problemFor = (field: ExtensionAppField): AppFormProblem | undefined =>
    problems.find((p) => p.field === field);

  const set = <K extends keyof AppFormValues>(
    key: K,
    value: AppFormValues[K],
  ): void => {
    setValues((prev) => ({ ...prev, [key]: value }));
    // A field being retyped is no longer the refused value.
    if (key === "slug" || key === "name" || key === "url")
      setProblems((prev) => prev.filter((p) => p.field !== key));
  };

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    if (saving) return;
    const trimmed: AppFormValues = {
      slug: values.slug.trim(),
      name: values.name.trim(),
      url: values.url.trim(),
      icon: values.icon,
      description: values.description.trim(),
    };
    const local = extensionAppProblems({
      ...(mode === "register" ? { slug: trimmed.slug } : {}),
      name: trimmed.name,
      url: trimmed.url,
    });
    if (local.length > 0) {
      setProblems(local);
      return;
    }
    setSaving(true);
    setFailed(false);
    onSubmit(trimmed).then(
      (result) => {
        setSaving(false);
        if (result && result.length > 0) setProblems(result);
      },
      () => {
        setSaving(false);
        setFailed(true);
      },
    );
  };

  // The Enter that CONFIRMS a Japanese conversion must not submit the form
  // (frontend.md §IME — WebKit sends it with isComposing false).
  const guardIme = (e: KeyboardEvent<HTMLFormElement>): void => {
    if (e.key === "Enter" && isImeComposing(e)) e.preventDefault();
  };

  const fieldError = (field: ExtensionAppField, id: string) => {
    const problem = problemFor(field);
    return problem ? (
      <p id={`${id}-error`} className="text-xs text-lumen-danger">
        {labels.problems[problem.issue]}
      </p>
    ) : null;
  };

  const describedBy = (field: ExtensionAppField, id: string, extra?: string) =>
    [problemFor(field) ? `${id}-error` : null, extra]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <form
      onSubmit={submit}
      onKeyDown={guardIme}
      className="flex flex-col gap-3"
      noValidate
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={ids.slug} className={FIELD_LABEL}>
          {labels.slug}
        </label>
        <Input
          id={ids.slug}
          value={values.slug}
          readOnly={mode === "edit"}
          invalid={problemFor("slug") != null}
          aria-describedby={describedBy("slug", ids.slug, `${ids.slug}-hint`)}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => set("slug", e.target.value)}
        />
        <p id={`${ids.slug}-hint`} className="text-xs text-lumen-text-tertiary">
          {labels.slugHint}
        </p>
        {fieldError("slug", ids.slug)}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={ids.name} className={FIELD_LABEL}>
          {labels.name}
        </label>
        <Input
          id={ids.name}
          value={values.name}
          invalid={problemFor("name") != null}
          aria-describedby={describedBy("name", ids.name)}
          onChange={(e) => set("name", e.target.value)}
        />
        {fieldError("name", ids.name)}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={ids.url} className={FIELD_LABEL}>
          {labels.url}
        </label>
        <Input
          id={ids.url}
          type="url"
          inputMode="url"
          value={values.url}
          placeholder={labels.urlPlaceholder}
          invalid={problemFor("url") != null}
          aria-describedby={describedBy("url", ids.url)}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => set("url", e.target.value)}
        />
        {fieldError("url", ids.url)}
      </div>

      <div className="flex flex-col gap-1">
        <span className={FIELD_LABEL}>{labels.icon.iconLabel}</span>
        <div className="flex items-center gap-2">
          <TagIconPicker
            current={values.icon}
            color={null}
            onPick={(next) => set("icon", next)}
            triggerLabel={labels.icon.change}
            triggerClassName={CARD_BTN_TAP}
            labels={{
              iconLabel: labels.icon.iconLabel,
              clearIconLabel: labels.icon.clearIconLabel,
              searchLabel: labels.icon.searchLabel,
              noMatchLabel: labels.icon.noMatchLabel,
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={ids.description} className={FIELD_LABEL}>
          {labels.description}
        </label>
        <textarea
          id={ids.description}
          rows={3}
          value={values.description}
          className={FIELD}
          onChange={(e) => set("description", e.target.value)}
        />
      </div>

      {failed && (
        <p role="alert" className="text-xs text-lumen-danger">
          {labels.saveFailed}
        </p>
      )}

      <div className="mt-1 flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={CARD_BTN_TAP}
          onClick={onClose}
        >
          {labels.cancel}
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          className={CARD_BTN_TAP}
          busy={saving}
          busyLabel={labels.saving}
        >
          {labels.save}
        </Button>
      </div>
    </form>
  );
}
