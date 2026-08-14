import { describe, it, expect } from "vitest";
import { TOOLS } from "../src/tools.js";
import {
  formatTodo,
  formatTodoListEntry,
} from "../src/handlers/todoHandlers.js";
import {
  formatNote,
  formatNoteListEntry,
} from "../src/handlers/noteHandlers.js";
import { PREVIEW_LENGTH } from "../src/utils/content.js";
import type { ItemsMetaRow } from "../src/utils/items.js";
import type { NotesPayloadRow } from "../src/handlers/noteHandlers.js";

/*
 * What a list result costs, and whether a body can be read back (#702 ①).
 *
 * `list_todos` / `list_notes` used to return every item's whole TipTap JSON
 * body. Asking "what is on my plate" therefore cost the entire collection's
 * content in one answer, and the JSON that came back could not be handed to
 * update_todo / update_note (those take Markdown) — the two problems this
 * chunk removes together.
 *
 * These are the pieces that can be checked without Supabase: the formatters
 * (pure functions over a row pair) and the schemas Claude Code reads at
 * connect time.
 */

const META: ItemsMetaRow = {
  id: "note-1",
  title: "買い物メモ",
  is_deleted: false,
  deleted_at: null,
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-02T00:00:00Z",
};

/** A TipTap document whose text is `text`, as the DB stores it. */
const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

const TODO_PAYLOAD = {
  item_id: "task-1",
  parent_item_id: null,
  task_type: "task" as const,
  status: "NOT_STARTED",
  content: JSON.stringify(doc("牛乳と卵を買う")),
  time_memo: null,
  scheduled_at: null,
  scheduled_end_at: null,
  is_all_day: false,
  completed_at: null,
  sort_order: 0,
};

const NOTE_PAYLOAD: NotesPayloadRow = {
  item_id: "note-1",
  note_type: "note",
  content_json: doc("牛乳と卵を買う"),
  is_pinned: false,
  color: null,
};

describe("list entries carry a preview, not the body", () => {
  it("omits the todo body by default and previews it instead", () => {
    const entry = formatTodoListEntry(META, TODO_PAYLOAD, false);

    expect(entry).not.toHaveProperty("content");
    expect(entry).not.toHaveProperty("contentText");
    expect(entry.contentPreview).toBe("牛乳と卵を買う");
  });

  it("omits the note body by default and previews it instead", () => {
    const entry = formatNoteListEntry(META, NOTE_PAYLOAD, false);

    expect(entry).not.toHaveProperty("content");
    expect(entry).not.toHaveProperty("contentText");
    expect(entry.contentPreview).toBe("牛乳と卵を買う");
  });

  it("caps the preview so one long item cannot dominate a page", () => {
    const long = {
      ...TODO_PAYLOAD,
      content: JSON.stringify(doc("あ".repeat(500))),
    };
    expect(formatTodoListEntry(META, long, false).contentPreview).toHaveLength(
      PREVIEW_LENGTH,
    );
  });

  it("returns the body only when the caller asks for it", () => {
    const entry = formatTodoListEntry(META, TODO_PAYLOAD, true);

    expect(entry).toHaveProperty("content", TODO_PAYLOAD.content);
    expect(entry).toHaveProperty("contentText", "牛乳と卵を買う");
    // Still previewed: include_content adds to the entry, never replaces it.
    expect(entry.contentPreview).toBe("牛乳と卵を買う");
  });

  it("previews an empty body as an empty string rather than null", () => {
    const empty = { ...TODO_PAYLOAD, content: null };
    expect(formatTodoListEntry(META, empty, false).contentPreview).toBe("");
  });
});

describe("a single-item read can be written back", () => {
  it("gives get_todo the plain text update_todo accepts", () => {
    const todo = formatTodo(META, TODO_PAYLOAD);

    // The stored body stays available for callers that render TipTap …
    expect(todo.content).toBe(TODO_PAYLOAD.content);
    // … but the round trip runs through the plain text, since update_todo
    // takes Markdown and would bury raw JSON in the document as literal text.
    expect(todo.contentText).toBe("牛乳と卵を買う");
  });

  it("gives get_note the plain text update_note accepts", () => {
    const note = formatNote(META, NOTE_PAYLOAD);

    expect(note.content).toBe(JSON.stringify(NOTE_PAYLOAD.content_json));
    expect(note.contentText).toBe("牛乳と卵を買う");
  });
});

describe("the published schemas say so", () => {
  const tool = (name: string) => TOOLS.find((t) => t.name === name);
  const props = (name: string) =>
    (tool(name)?.inputSchema.properties ?? {}) as Record<string, unknown>;

  it.each(["list_todos", "list_notes"])(
    "%s offers include_content and limit",
    (name) => {
      expect(props(name)).toHaveProperty("include_content");
      expect(props(name)).toHaveProperty("limit");
    },
  );

  it.each(["list_todos", "list_notes"])(
    "%s tells the caller the result is previewed and capped",
    (name) => {
      const description = tool(name)?.description ?? "";
      expect(description).toMatch(/contentPreview/);
      expect(description).toMatch(/hasMore/);
    },
  );

  it("publishes get_note, the single-note read list_notes points at", () => {
    expect(tool("get_note")).toBeDefined();
    expect(tool("get_note")?.inputSchema.required).toEqual(["id"]);
  });
});
