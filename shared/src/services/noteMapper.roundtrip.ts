/*
 * NoteNode / NoteLink <-> DB row round-trip verification (S3-2).
 *
 * shared/ has no test runner (out of S1/S2/S3 scope), so this is a
 * self-contained, type-checked module that ASSERTS the mapper round-trip
 * at runtime. It is:
 *   - type-checked by `tsc -b` (part of the shared program), and
 *   - runnable standalone: `node dist/services/noteMapper.roundtrip.js`
 *     after `tsc -b` — exits non-zero on any mismatch.
 *
 * NOTE round-trip property: for a row R produced from a NoteNode N,
 *   rowToNoteNode( {...noteNodeToRow(N), user_id, has_password} )
 *   deep-equals the normalised N. `noteNodeToRow` drops the
 *   server-derived `user_id` and the read-only generated `has_password`,
 *   so the harness re-attaches them exactly as Postgres / the SELECT
 *   would (RLS default + the `has_password` GENERATED column =
 *   `password_hash is not null`) before reading back. is_pinned /
 *   is_edit_locked / is_deleted / hasPassword are always materialised by
 *   rowToNoteNode (NOT-NULL-with-default / always-projected columns).
 *
 * NOTE LINK round-trip property: every NoteLink field is required by the
 * type, so noteLinkToRow ∘ rowToNoteLink is a straight bijection (the
 * only coercion is is_deleted boolean <-> 0/1 number); no
 * user_id/generated-column re-attachment dance is needed beyond user_id.
 */
// NOTE: the `.js` extensions are deliberate and ONLY in this harness
// (identical rationale to dailyMapper.roundtrip.ts): bundler resolution
// accepts them and the compiled dist file is runnable under Node ESM
// with no extra tooling. It imports the pure mappers (NOT
// SupabaseDataService) so it carries no @supabase/supabase-js dependency.
import type { NoteNode } from "../types/note.js";
import type { NoteLink } from "../types/noteLink.js";
import { rowToNoteNode, noteNodeToRow, type NoteRow } from "./noteMapper.js";
import {
  rowToNoteLink,
  noteLinkToRow,
  type NoteLinkRow,
} from "./noteLinkMapper.js";

function reattachServerColumns(
  writeRow: ReturnType<typeof noteNodeToRow>,
  hasPassword: boolean,
): NoteRow {
  // What the SELECT adds back: user_id (RLS default auth.uid()) and
  // has_password (the read-only GENERATED column = `password_hash is not
  // null`, never the raw hash).
  return {
    ...writeRow,
    user_id: "00000000-0000-0000-0000-000000000000",
    has_password: hasPassword,
  };
}

function normaliseNote(n: NoteNode, hasPassword: boolean): NoteNode {
  return rowToNoteNode(reattachServerColumns(noteNodeToRow(n), hasPassword));
}

function reattachLinkUserId(
  writeRow: ReturnType<typeof noteLinkToRow>,
): NoteLinkRow {
  return { ...writeRow, user_id: "00000000-0000-0000-0000-000000000000" };
}

function normaliseLink(l: NoteLink): NoteLink {
  return rowToNoteLink(reattachLinkUserId(noteLinkToRow(l)));
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.keys(v as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]),
    );
  }
  return v;
}

interface NoteCase {
  name: string;
  node: NoteNode;
  hasPassword: boolean;
}

const NOTE_CASES: NoteCase[] = [
  {
    name: "minimal note (no optional flags)",
    hasPassword: false,
    node: {
      id: "note-aaaaaaaa",
      type: "note",
      title: "Untitled",
      content: "",
      parentId: null,
      order: 0,
      isPinned: false,
      isDeleted: false,
      createdAt: "2026-05-16T00:00:00.000Z",
      updatedAt: "2026-05-16T00:00:00.000Z",
    },
  },
  {
    name: "pinned note with color/icon under a folder",
    hasPassword: false,
    node: {
      id: "note-bbbbbbbb",
      type: "note",
      title: "Pinned",
      content: '{"type":"doc","content":[]}',
      parentId: "notefolder-cccccccc",
      order: 3,
      isPinned: true,
      color: "#ff8800",
      icon: "star",
      isDeleted: false,
      createdAt: "2026-05-16T01:00:00.000Z",
      updatedAt: "2026-05-16T02:00:00.000Z",
    },
  },
  {
    name: "password-protected + edit-locked note",
    hasPassword: true,
    node: {
      id: "note-dddddddd",
      type: "note",
      title: "Secret",
      content: "locked",
      parentId: null,
      order: 0,
      isPinned: false,
      hasPassword: true,
      isEditLocked: true,
      isDeleted: false,
      createdAt: "2026-05-16T00:00:00.000Z",
      updatedAt: "2026-05-16T03:00:00.000Z",
    },
  },
  {
    name: "soft-deleted folder",
    hasPassword: false,
    node: {
      id: "notefolder-eeeeeeee",
      type: "folder",
      title: "Trashed Folder",
      content: "",
      parentId: null,
      order: 1,
      isPinned: false,
      isDeleted: true,
      deletedAt: "2026-05-16T04:00:00.000Z",
      createdAt: "2026-05-16T00:00:00.000Z",
      updatedAt: "2026-05-16T00:00:00.000Z",
    },
  },
];

const LINK_CASES: Array<{ name: string; link: NoteLink }> = [
  {
    name: "note-sourced inline link, all optional fields null",
    link: {
      id: "nl-11111111",
      sourceNoteId: "note-aaaaaaaa",
      sourceMemoDate: null,
      targetNoteId: "note-bbbbbbbb",
      targetHeading: null,
      targetBlockId: null,
      alias: null,
      linkType: "inline",
      createdAt: "2026-05-16T00:00:00.000Z",
      updatedAt: "2026-05-16T00:00:00.000Z",
      version: 1,
      isDeleted: 0,
      deletedAt: null,
    },
  },
  {
    name: "memo-sourced embed link with heading/alias, soft-deleted",
    link: {
      id: "nl-22222222",
      sourceNoteId: null,
      sourceMemoDate: "2026-05-16",
      targetNoteId: "note-cccccccc",
      targetHeading: "Section 2",
      targetBlockId: "block-xyz",
      alias: "see here",
      linkType: "embed",
      createdAt: "2026-05-16T01:00:00.000Z",
      updatedAt: "2026-05-16T05:00:00.000Z",
      version: 4,
      isDeleted: 1,
      deletedAt: "2026-05-16T05:00:00.000Z",
    },
  },
];

function run(): number {
  let failures = 0;

  for (const c of NOTE_CASES) {
    const expected = normaliseNote(c.node, c.hasPassword);
    const actual = rowToNoteNode(
      reattachServerColumns(noteNodeToRow(c.node), c.hasPassword),
    );
    if (deepEqual(expected, actual)) {
      console.log(`  PASS  note: ${c.name}`);
    } else {
      failures++;
      console.error(`  FAIL  note: ${c.name}`);
      console.error(`    expected: ${JSON.stringify(expected)}`);
      console.error(`    actual:   ${JSON.stringify(actual)}`);
    }
    const twice = normaliseNote(expected, c.hasPassword);
    if (deepEqual(expected, twice)) {
      console.log(`  PASS  note idempotent: ${c.name}`);
    } else {
      failures++;
      console.error(`  FAIL  note idempotent: ${c.name}`);
    }
  }

  for (const c of LINK_CASES) {
    const actual = normaliseLink(c.link);
    if (deepEqual(c.link, actual)) {
      console.log(`  PASS  link: ${c.name}`);
    } else {
      failures++;
      console.error(`  FAIL  link: ${c.name}`);
      console.error(`    expected: ${JSON.stringify(c.link)}`);
      console.error(`    actual:   ${JSON.stringify(actual)}`);
    }
  }

  const total = NOTE_CASES.length * 2 + LINK_CASES.length;
  console.log(
    `\nNote round-trip summary: ${total - failures} passed, ${failures} failed.`,
  );
  return failures;
}

// Execute when run directly (tsx/node). Importing it does not auto-run.
declare const process: { argv: string[]; exit: (code: number) => never };
const isMain =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  process.argv[1]?.includes("noteMapper.roundtrip");
if (isMain) {
  process.exit(run() === 0 ? 0 : 1);
}

export { run as runNoteRoundtripChecks };
