import { useId, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "./cn";
import { Button } from "./Button";
import { Input } from "./Input";
import { ConfirmDialog, useConfirmDialog } from "./ConfirmDialog";
import { SettingsSegment } from "./SettingsSegment";
import {
  AI_MEMORY_BODY_MAX_CHARS,
  AI_RULE_BODY_MAX_CHARS,
  AI_SKILL_BODY_MAX_CHARS,
  AI_SKILL_DESCRIPTION_MAX_CHARS,
  AI_SKILL_SLUG_MAX_CHARS,
  aiMemoryBodyIssue,
  aiRuleBodyIssue,
  aiSkillIssues,
  countChars,
} from "../services/aiCustomizationLimits";
import type {
  AiCustomizationIssue,
  AiMemory,
  AiRule,
  AiSkill,
  AiSkillInput,
} from "../types/aiCustomization";

export type AiCustomizationTab = "rules" | "memories" | "skills";

export interface SettingsAiCustomizationLabels {
  back: string;
  heading: string;
  description: string;
  tabsLabel: string;
  tabRules: string;
  tabMemories: string;
  tabSkills: string;
  loading: string;
  rulesDescription: string;
  rulesPlaceholder: string;
  memoriesDescription: string;
  memoriesEmpty: string;
  memoryPlaceholder: string;
  addMemory: string;
  skillsDescription: string;
  skillsEmpty: string;
  newSkill: string;
  skillSlug: string;
  skillSlugHint: string;
  skillDescription: string;
  skillBody: string;
  skillBodyPlaceholder: string;
  save: string;
  saving: string;
  saved: string;
  cancel: string;
  edit: string;
  delete: string;
  /** "{{n}} / {{max}}" already shaped by the host — see `counter`. */
  counter: (n: number, max: number) => string;
  confirmDeleteMemory: string;
  confirmDeleteSkill: (slug: string) => string;
  issues: Record<AiCustomizationIssue, string>;
}

/**
 * Every write resolves to an already-translated error sentence, or null when
 * it landed — the launcher's contract (#1211): the host owns the copy (§6.4),
 * so this component never learns WHICH refusal it was.
 */
export interface SettingsAiCustomizationProps {
  /** null while the first read is in flight. */
  data: {
    rule: AiRule | null;
    memories: AiMemory[];
    skills: AiSkill[];
  } | null;
  /** A translated sentence when the read failed. */
  loadError?: string | null;
  onBack: () => void;
  onSaveRule: (body: string) => Promise<string | null>;
  onCreateMemory: (body: string) => Promise<string | null>;
  onUpdateMemory: (id: string, body: string) => Promise<string | null>;
  onDeleteMemory: (id: string) => Promise<string | null>;
  onCreateSkill: (input: AiSkillInput) => Promise<string | null>;
  onUpdateSkill: (
    id: string,
    updates: Partial<AiSkillInput>,
  ) => Promise<string | null>;
  onDeleteSkill: (id: string) => Promise<string | null>;
  labels: SettingsAiCustomizationLabels;
}

/*
 * Claude customization editor (#2119, Epic #2117 R1 / R2) — the rules, the
 * memories and the Claude skills Life Editor hands to the Claude Code it
 * launches (written out by #2120, written back by Claude through #2121).
 *
 * One screen for Desktop and Mobile: there is nothing here that needs the
 * desktop bridge, so the phone edits and saves exactly what the desktop does
 * (D-20261006-main-1). The launch button stays on the AI card, which hides it
 * off the desktop on its own.
 *
 * Deletes are physical (0037 — none of the three goes to the Trash), so each
 * one asks first and names what it removes (#1248's lesson).
 *
 * Named "Claude skills" on screen, never "templates": the Materials note
 * templates (#1179〜#1181) already own that word in this app.
 */
export function SettingsAiCustomization({
  data,
  loadError = null,
  onBack,
  onSaveRule,
  onCreateMemory,
  onUpdateMemory,
  onDeleteMemory,
  onCreateSkill,
  onUpdateSkill,
  onDeleteSkill,
  labels,
}: SettingsAiCustomizationProps) {
  const [tab, setTab] = useState<AiCustomizationTab>("rules");
  const confirm = useConfirmDialog();

  return (
    <div className="flex flex-col gap-4" data-section-id="ai-customization">
      <div className="flex flex-col gap-2">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            leadingIcon={<ArrowLeft size={14} aria-hidden="true" />}
            className="max-md:min-h-11"
          >
            {labels.back}
          </Button>
        </div>
        <h3 className="text-base font-semibold text-lumen-text">
          {labels.heading}
        </h3>
        <p className="text-sm leading-relaxed text-lumen-text-secondary">
          {labels.description}
        </p>
      </div>

      <SettingsSegment<AiCustomizationTab>
        label={labels.tabsLabel}
        hideLabel
        value={tab}
        onChange={setTab}
        options={[
          { value: "rules", label: labels.tabRules },
          { value: "memories", label: labels.tabMemories },
          { value: "skills", label: labels.tabSkills },
        ]}
      />

      {loadError ? (
        <p role="alert" className="text-sm text-lumen-danger">
          {loadError}
        </p>
      ) : data === null ? (
        <p className="text-sm text-lumen-text-secondary">{labels.loading}</p>
      ) : tab === "rules" ? (
        <RulesPane rule={data.rule} onSave={onSaveRule} labels={labels} />
      ) : tab === "memories" ? (
        <MemoriesPane
          memories={data.memories}
          onCreate={onCreateMemory}
          onUpdate={onUpdateMemory}
          onDelete={(id) =>
            confirm
              .ask({
                message: labels.confirmDeleteMemory,
                confirmLabel: labels.delete,
                cancelLabel: labels.cancel,
                danger: true,
              })
              .then((yes) => (yes ? onDeleteMemory(id) : null))
          }
          labels={labels}
        />
      ) : (
        <SkillsPane
          skills={data.skills}
          onCreate={onCreateSkill}
          onUpdate={onUpdateSkill}
          onDelete={(skill) =>
            confirm
              .ask({
                message: labels.confirmDeleteSkill(skill.slug),
                confirmLabel: labels.delete,
                cancelLabel: labels.cancel,
                danger: true,
              })
              .then((yes) => (yes ? onDeleteSkill(skill.id) : null))
          }
          labels={labels}
        />
      )}

      {confirm.request && (
        <ConfirmDialog
          open
          {...confirm.request}
          onConfirm={() => confirm.resolve(true)}
          onCancel={() => confirm.resolve(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

const TEXTAREA = cn(
  "w-full rounded-lumen-md border bg-lumen-bg px-3 py-2 text-sm leading-relaxed text-lumen-text",
  "placeholder:text-lumen-text-secondary",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
);

function TextArea({
  id,
  value,
  onChange,
  rows,
  placeholder,
  invalid,
  label,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
  placeholder?: string;
  invalid: boolean;
  label?: string;
}) {
  return (
    <textarea
      id={id}
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      spellCheck={false}
      aria-invalid={invalid || undefined}
      className={cn(
        TEXTAREA,
        invalid ? "border-lumen-danger" : "border-lumen-border",
      )}
    />
  );
}

/** "n / max" plus the issue sentence, under a field. */
function FieldFoot({
  text,
  max,
  issue,
  labels,
}: {
  text: string;
  max: number;
  issue: AiCustomizationIssue | null | undefined;
  labels: SettingsAiCustomizationLabels;
}) {
  // `empty` is not worth shouting about while the field is still untouched;
  // the save button is disabled for it anyway.
  const shown = issue && issue !== "empty" ? labels.issues[issue] : null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
      <span className="text-lumen-danger">{shown}</span>
      <span
        className={cn(
          "tabular-nums",
          issue === "tooLong"
            ? "text-lumen-danger"
            : "text-lumen-text-secondary",
        )}
      >
        {labels.counter(countChars(text), max)}
      </span>
    </div>
  );
}

function Status({
  message,
}: {
  message: { text: string; failed: boolean } | null;
}) {
  if (!message) return null;
  return (
    <p
      role="status"
      className={cn(
        "text-xs",
        message.failed ? "text-lumen-danger" : "text-lumen-text",
      )}
    >
      {message.text}
    </p>
  );
}

/** Runs a write and turns its answer into the line under the buttons. */
function useWrite(savedText: string) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    failed: boolean;
  } | null>(null);
  const run = async (
    write: () => Promise<string | null>,
    onDone?: () => void,
  ): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const error = await write();
      if (error === null) {
        setMessage({ text: savedText, failed: false });
        onDone?.();
      } else {
        setMessage({ text: error, failed: true });
      }
    } catch {
      // The host resolves either way; one that rejects must still leave the
      // button usable for a retry.
      setMessage(null);
    } finally {
      setBusy(false);
    }
  };
  return { busy, message, setMessage, run };
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lumen-md border border-lumen-border bg-lumen-bg-secondary px-4 py-3">
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

function RulesPane({
  rule,
  onSave,
  labels,
}: {
  rule: AiRule | null;
  onSave: (body: string) => Promise<string | null>;
  labels: SettingsAiCustomizationLabels;
}) {
  const stored = rule?.body ?? "";
  const [draft, setDraft] = useState(stored);
  // The stored text the draft was seeded from. When the stored rules move on
  // (this save, or another device's) and the user has not typed since, the
  // draft follows; a draft with unsaved edits is never overwritten.
  const [base, setBase] = useState(stored);
  if (stored !== base) {
    setBase(stored);
    if (draft === base) setDraft(stored);
  }
  const write = useWrite(labels.saved);
  const issue = aiRuleBodyIssue(draft);
  const dirty = draft !== stored;

  return (
    <Panel>
      <p className="text-xs leading-relaxed text-lumen-text-secondary">
        {labels.rulesDescription}
      </p>
      <TextArea
        label={labels.tabRules}
        value={draft}
        onChange={(v) => {
          setDraft(v);
          write.setMessage(null);
        }}
        rows={14}
        placeholder={labels.rulesPlaceholder}
        invalid={issue !== null}
      />
      <FieldFoot
        text={draft}
        max={AI_RULE_BODY_MAX_CHARS}
        issue={issue}
        labels={labels}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => void write.run(() => onSave(draft))}
          disabled={!dirty || issue !== null}
          busy={write.busy}
          busyLabel={labels.saving}
          className="max-md:min-h-11"
        >
          {labels.save}
        </Button>
        <Status message={write.message} />
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Memories
// ---------------------------------------------------------------------------

function MemoriesPane({
  memories,
  onCreate,
  onUpdate,
  onDelete,
  labels,
}: {
  memories: AiMemory[];
  onCreate: (body: string) => Promise<string | null>;
  onUpdate: (id: string, body: string) => Promise<string | null>;
  onDelete: (id: string) => Promise<string | null>;
  labels: SettingsAiCustomizationLabels;
}) {
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const add = useWrite(labels.saved);
  const issue = aiMemoryBodyIssue(draft);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs leading-relaxed text-lumen-text-secondary">
        {labels.memoriesDescription}
      </p>
      {memories.length === 0 ? (
        <p className="text-sm text-lumen-text-secondary">
          {labels.memoriesEmpty}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-lumen-border rounded-lumen-md border border-lumen-border bg-lumen-bg-secondary">
          {memories.map((memory) =>
            editing === memory.id ? (
              <li key={memory.id} className="px-4 py-3">
                <MemoryEditor
                  memory={memory}
                  onSave={(body) => onUpdate(memory.id, body)}
                  onClose={() => setEditing(null)}
                  labels={labels}
                />
              </li>
            ) : (
              <MemoryRow
                key={memory.id}
                memory={memory}
                onEdit={() => setEditing(memory.id)}
                onDelete={() => onDelete(memory.id)}
                labels={labels}
              />
            ),
          )}
        </ul>
      )}

      <Panel>
        <TextArea
          label={labels.memoryPlaceholder}
          value={draft}
          onChange={(v) => {
            setDraft(v);
            add.setMessage(null);
          }}
          rows={3}
          placeholder={labels.memoryPlaceholder}
          invalid={issue !== null && issue !== "empty"}
        />
        <FieldFoot
          text={draft}
          max={AI_MEMORY_BODY_MAX_CHARS}
          issue={issue}
          labels={labels}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() =>
              void add.run(
                () => onCreate(draft),
                () => setDraft(""),
              )
            }
            disabled={issue !== null}
            busy={add.busy}
            busyLabel={labels.saving}
            leadingIcon={<Plus size={14} aria-hidden="true" />}
            className="max-md:min-h-11"
          >
            {labels.addMemory}
          </Button>
          <Status message={add.message} />
        </div>
      </Panel>
    </div>
  );
}

function MemoryRow({
  memory,
  onEdit,
  onDelete,
  labels,
}: {
  memory: AiMemory;
  onEdit: () => void;
  onDelete: () => Promise<string | null>;
  labels: SettingsAiCustomizationLabels;
}) {
  const write = useWrite(labels.saved);
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <p className="whitespace-pre-wrap break-words text-sm text-lumen-text">
        {memory.body}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          leadingIcon={<Pencil size={14} aria-hidden="true" />}
          className="max-md:min-h-11"
        >
          {labels.edit}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void write.run(onDelete)}
          busy={write.busy}
          leadingIcon={<Trash2 size={14} aria-hidden="true" />}
          className="max-md:min-h-11"
        >
          {labels.delete}
        </Button>
        {write.message?.failed && <Status message={write.message} />}
      </div>
    </li>
  );
}

function MemoryEditor({
  memory,
  onSave,
  onClose,
  labels,
}: {
  memory: AiMemory;
  onSave: (body: string) => Promise<string | null>;
  onClose: () => void;
  labels: SettingsAiCustomizationLabels;
}) {
  const [draft, setDraft] = useState(memory.body);
  const write = useWrite(labels.saved);
  const issue = aiMemoryBodyIssue(draft);
  return (
    <div className="flex flex-col gap-2">
      <TextArea
        label={labels.edit}
        value={draft}
        onChange={setDraft}
        rows={3}
        invalid={issue !== null}
      />
      <FieldFoot
        text={draft}
        max={AI_MEMORY_BODY_MAX_CHARS}
        issue={issue}
        labels={labels}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => void write.run(() => onSave(draft), onClose)}
          disabled={issue !== null || draft === memory.body}
          busy={write.busy}
          busyLabel={labels.saving}
          className="max-md:min-h-11"
        >
          {labels.save}
        </Button>
        <Button variant="ghost" onClick={onClose} className="max-md:min-h-11">
          {labels.cancel}
        </Button>
        {write.message?.failed && <Status message={write.message} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Claude skills
// ---------------------------------------------------------------------------

/** "new" = the empty form; a skill = editing that one; null = the list. */
type SkillEditing = "new" | AiSkill | null;

function SkillsPane({
  skills,
  onCreate,
  onUpdate,
  onDelete,
  labels,
}: {
  skills: AiSkill[];
  onCreate: (input: AiSkillInput) => Promise<string | null>;
  onUpdate: (
    id: string,
    updates: Partial<AiSkillInput>,
  ) => Promise<string | null>;
  onDelete: (skill: AiSkill) => Promise<string | null>;
  labels: SettingsAiCustomizationLabels;
}) {
  const [editing, setEditing] = useState<SkillEditing>(null);

  if (editing !== null) {
    const skill = editing === "new" ? null : editing;
    return (
      <SkillEditor
        key={skill?.id ?? "new"}
        skill={skill}
        onSave={(input) =>
          skill === null ? onCreate(input) : onUpdate(skill.id, input)
        }
        onClose={() => setEditing(null)}
        labels={labels}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs leading-relaxed text-lumen-text-secondary">
        {labels.skillsDescription}
      </p>
      <div>
        <Button
          onClick={() => setEditing("new")}
          leadingIcon={<Plus size={14} aria-hidden="true" />}
          className="max-md:min-h-11"
        >
          {labels.newSkill}
        </Button>
      </div>
      {skills.length === 0 ? (
        <p className="text-sm text-lumen-text-secondary">
          {labels.skillsEmpty}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-lumen-border rounded-lumen-md border border-lumen-border bg-lumen-bg-secondary">
          {skills.map((skill) => (
            <SkillRow
              key={skill.id}
              skill={skill}
              onEdit={() => setEditing(skill)}
              onDelete={() => onDelete(skill)}
              labels={labels}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function SkillRow({
  skill,
  onEdit,
  onDelete,
  labels,
}: {
  skill: AiSkill;
  onEdit: () => void;
  onDelete: () => Promise<string | null>;
  labels: SettingsAiCustomizationLabels;
}) {
  const write = useWrite(labels.saved);
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <code className="break-all text-xs font-semibold text-lumen-text">
        {skill.slug}
      </code>
      <p className="break-words text-xs leading-relaxed text-lumen-text-secondary">
        {skill.description}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          aria-label={`${labels.edit}: ${skill.slug}`}
          leadingIcon={<Pencil size={14} aria-hidden="true" />}
          className="max-md:min-h-11"
        >
          {labels.edit}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void write.run(onDelete)}
          busy={write.busy}
          aria-label={`${labels.delete}: ${skill.slug}`}
          leadingIcon={<Trash2 size={14} aria-hidden="true" />}
          className="max-md:min-h-11"
        >
          {labels.delete}
        </Button>
        {write.message?.failed && <Status message={write.message} />}
      </div>
    </li>
  );
}

function SkillEditor({
  skill,
  onSave,
  onClose,
  labels,
}: {
  skill: AiSkill | null;
  onSave: (input: AiSkillInput) => Promise<string | null>;
  onClose: () => void;
  labels: SettingsAiCustomizationLabels;
}) {
  const [slug, setSlug] = useState(skill?.slug ?? "");
  const [description, setDescription] = useState(skill?.description ?? "");
  const [body, setBody] = useState(skill?.body ?? "");
  const write = useWrite(labels.saved);
  const slugId = useId();
  const descriptionId = useId();
  const bodyId = useId();

  const input: AiSkillInput = { slug, description, body };
  const issues = aiSkillIssues(input);
  const valid = Object.keys(issues).length === 0;
  const dirty =
    skill === null ||
    slug !== skill.slug ||
    description !== skill.description ||
    body !== skill.body;

  return (
    <Panel>
      <label
        htmlFor={slugId}
        className="text-xs font-medium text-lumen-text-secondary"
      >
        {labels.skillSlug}
      </label>
      <Input
        id={slugId}
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        invalid={issues.slug !== undefined && issues.slug !== "empty"}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        placeholder="my-skill"
      />
      <p className="text-xs text-lumen-text-secondary">
        {labels.skillSlugHint}
      </p>
      <FieldFoot
        text={slug}
        max={AI_SKILL_SLUG_MAX_CHARS}
        issue={issues.slug}
        labels={labels}
      />

      <label
        htmlFor={descriptionId}
        className="text-xs font-medium text-lumen-text-secondary"
      >
        {labels.skillDescription}
      </label>
      <Input
        id={descriptionId}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        invalid={
          issues.description !== undefined && issues.description !== "empty"
        }
        autoComplete="off"
      />
      <FieldFoot
        text={description}
        max={AI_SKILL_DESCRIPTION_MAX_CHARS}
        issue={issues.description}
        labels={labels}
      />

      <label
        htmlFor={bodyId}
        className="text-xs font-medium text-lumen-text-secondary"
      >
        {labels.skillBody}
      </label>
      <TextArea
        id={bodyId}
        value={body}
        onChange={setBody}
        rows={12}
        placeholder={labels.skillBodyPlaceholder}
        invalid={issues.body !== undefined}
      />
      <FieldFoot
        text={body}
        max={AI_SKILL_BODY_MAX_CHARS}
        issue={issues.body}
        labels={labels}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => void write.run(() => onSave(input), onClose)}
          disabled={!valid || !dirty}
          busy={write.busy}
          busyLabel={labels.saving}
          className="max-md:min-h-11"
        >
          {labels.save}
        </Button>
        <Button variant="ghost" onClick={onClose} className="max-md:min-h-11">
          {labels.cancel}
        </Button>
        {write.message?.failed && <Status message={write.message} />}
      </div>
    </Panel>
  );
}
