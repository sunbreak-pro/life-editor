import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { DataService, NoteNode } from "@life-editor/shared";
import { NoteTemplateHost } from "../src/notes/NoteTemplateHost";
import { stubDataService } from "./helpers";

/*
 * Note templates (#1047) — the wired surface.
 *
 * What is worth pinning is not the panel's markup but the four claims the
 * feature rests on, each of which fails silently if it regresses:
 *
 *   1. a new template is written as note_type='template'. Get this wrong and it
 *      is a NOTE — it lands in the list the user was trying to keep clean, and
 *      nothing about the template panel looks broken.
 *   2. "create a note from this template" hands the NAME and the BODY to the
 *      host, which is the only way the note ever gets the template's content.
 *   3. deleting is a soft delete of that row.
 *   4. there is no tag or link UI here. This is the DoD sentence, and it is the
 *      one thing a future refactor is most likely to undo by "unifying" this
 *      panel with the note detail.
 *
 * `useTranslation` is stubbed to echo its key, so the assertions read against
 * "materials.templates.*" rather than a translated sentence. <RichTextEditor>
 * is stubbed because TipTap needs a real layout to mount; what this suite cares
 * about is which props it is handed (specifically: NOT the "[[" loader).
 */

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@life-editor/shared")>()),
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "ja" } }),
}));

const editorProps: Record<string, unknown>[] = [];
vi.mock("../src/notes/RichTextEditor", () => ({
  RichTextEditor: (props: Record<string, unknown>) => {
    editorProps.push(props);
    return <div data-testid="body-editor">{String(props.noteId)}</div>;
  },
}));

function makeTemplate(id: string, title: string, content = ""): NoteNode {
  return {
    id,
    type: "template",
    title,
    content,
    parentId: null,
    order: 0,
    isPinned: false,
    isDeleted: false,
    createdAt: "2026-08-18T00:00:00.000Z",
    updatedAt: "2026-08-18T00:00:00.000Z",
  };
}

function makeDS(
  templates: NoteNode[],
  overrides: Partial<Record<keyof DataService, unknown>> = {},
): DataService {
  return stubDataService({
    listNoteTemplatesUnified: async () => templates,
    getNoteUnified: async (id: string) =>
      templates.find((t) => t.id === id) ?? null,
    createNoteUnified: async (node: NoteNode) => node,
    updateNoteUnified: async (id: string, updates: Partial<NoteNode>) => ({
      ...makeTemplate(id, "x"),
      ...updates,
    }),
    softDeleteNoteUnified: async () => {},
    ...overrides,
  });
}

describe("NoteTemplateHost (#1047)", () => {
  it("lists the saved templates and opens one for editing", async () => {
    const ds = makeDS([makeTemplate("note-t1", "Weekly review", "<p>a</p>")]);
    render(
      <NoteTemplateHost
        dataService={ds}
        open
        isWide
        onClose={() => {}}
        onUseTemplate={() => {}}
      />,
    );

    const row = await screen.findByText("Weekly review");
    // Nothing is selected on open, so the editor column is the hint.
    expect(screen.getByText("materials.templates.pickHint")).toBeTruthy();

    fireEvent.click(row);
    await waitFor(() => screen.getByTestId("body-editor"));
    expect(
      (
        screen.getByLabelText(
          "materials.templates.nameLabel",
        ) as HTMLInputElement
      ).value,
    ).toBe("Weekly review");
  });

  it("writes a new template as note_type='template', not as a note", async () => {
    const created: NoteNode[] = [];
    const ds = makeDS([], {
      createNoteUnified: async (node: NoteNode) => {
        created.push(node);
        return node;
      },
    });
    render(
      <NoteTemplateHost
        dataService={ds}
        open
        isWide
        onClose={() => {}}
        onUseTemplate={() => {}}
      />,
    );

    fireEvent.click(await screen.findByText("materials.templates.new"));

    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0].type).toBe("template");
    expect(created[0].id.startsWith("note-")).toBe(true);
  });

  it("hands the name and body to the host, then closes (create a note)", async () => {
    const onUseTemplate = vi.fn();
    const onClose = vi.fn();
    const ds = makeDS([
      makeTemplate("note-t1", "Weekly review", "<p>body</p>"),
    ]);
    render(
      <NoteTemplateHost
        dataService={ds}
        open
        isWide
        onClose={onClose}
        onUseTemplate={onUseTemplate}
      />,
    );

    fireEvent.click(await screen.findByText("Weekly review"));
    await waitFor(() => screen.getByTestId("body-editor"));
    fireEvent.click(screen.getByText("materials.templates.use"));

    expect(onUseTemplate).toHaveBeenCalledWith("Weekly review", "<p>body</p>");
    expect(onClose).toHaveBeenCalled();
  });

  it("soft-deletes the row the trash button names", async () => {
    const deleted: string[] = [];
    const ds = makeDS([makeTemplate("note-t1", "Weekly review")], {
      softDeleteNoteUnified: async (id: string) => {
        deleted.push(id);
      },
    });
    render(
      <NoteTemplateHost
        dataService={ds}
        open
        isWide
        onClose={() => {}}
        onUseTemplate={() => {}}
      />,
    );

    fireEvent.click(await screen.findByLabelText("materials.templates.delete"));

    await waitFor(() => expect(deleted).toEqual(["note-t1"]));
    // Gone from the list without waiting for a refetch.
    expect(screen.queryByText("Weekly review")).toBeNull();
  });

  // The DoD sentence: "テンプレートにタグ / リンクの UI が出ないこと".
  it("offers no tag row, and no '[[' link wiring on the body", async () => {
    editorProps.length = 0;
    const ds = makeDS([makeTemplate("note-t1", "Weekly review")]);
    render(
      <NoteTemplateHost
        dataService={ds}
        open
        isWide
        onClose={() => {}}
        onUseTemplate={() => {}}
      />,
    );

    fireEvent.click(await screen.findByText("Weekly review"));
    await waitFor(() => screen.getByTestId("body-editor"));

    expect(screen.queryByTestId("tag-picker")).toBeNull();
    expect(screen.queryByText("materials.tags.pickerAdd")).toBeNull();
    // Absent rather than hidden: without a loader the "[[" menu never opens,
    // so a template cannot be given a link even by typing one.
    const props = editorProps.at(-1);
    expect(props?.loadLinkTargets).toBeUndefined();
    expect(props?.onCreateNoteForLink).toBeUndefined();
  });
});
