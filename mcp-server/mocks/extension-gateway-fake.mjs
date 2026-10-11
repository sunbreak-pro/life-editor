/*
 * The official fake of the life-editor extension-app gateway (#2145, plan
 * .claude/docs/vision/plans/2026-10-07-extension-app-gateway.md, R2).
 *
 *   Gateway version:    1.0.0
 *   life-editor commit: 8fc43d8dbcac2268a313781259a7fbf970f67fac
 *
 * Those two lines are the spec this file was written against. They are a
 * promise, not decoration: tests/extensionGatewayFake.test.ts fails when they
 * differ from spec/extension-gateway.json, so a spec bump forces a look at
 * this file. At run time the values come from the spec itself
 * (GATEWAY_VERSION / LIFE_EDITOR_COMMIT below).
 *
 * WHAT IT IS. A stand-in an extension app is tested against when the loop
 * that builds it holds no life-editor credentials (pdca-harness). It speaks
 * the same HTTP surface as mcp-server/src/worker.ts — token in the path
 * (/mcp/<token>) or `Authorization: Bearer`, 404 with no hint for anything
 * unauthorised, 405 + `allow: POST` for another method, stateless JSON-RPC —
 * and serves exactly the tools in the spec, validated the way the real
 * registry validates them, against an in-memory store. Same inputs, same
 * refusals, same result shapes: tests/extensionGatewayFake.test.ts feeds both
 * this file and the real handlers the same calls and compares.
 *
 * STANDALONE ON PURPOSE. Copy this file (and spec/extension-gateway.json) into
 * another repository and it runs: it imports node: built-ins only, and needs
 * Node 18+ for the global Request / Response. The spec is found at, in order,
 * $EXTENSION_GATEWAY_SPEC, ./extension-gateway.json next to this file, and
 * ../spec/extension-gateway.json (where it lives in life-editor).
 *
 * USE.
 *   import { createFakeGateway, listen } from "./extension-gateway-fake.mjs";
 *   const gateway = createFakeGateway({ token: "t" });
 *   const res = await gateway.fetch(new Request("http://x/mcp/t", {...}));
 *   const { port, close } = await listen(gateway, 0);
 * or from a shell:
 *   node mocks/extension-gateway-fake.mjs --port 8787 --token x [--origin http://localhost:5173]
 *
 * TEST-DOUBLE ROUTES. `listen()` also answers `GET /__calls` (every tools/call
 * received: tool, arguments, ok, error, timestamp) and `POST /__reset` (clears
 * the record AND the in-memory store). They need NO token, which is only
 * acceptable because this is a test double that never holds real data. They
 * live in `listen()` and not in `fetch()`, so `fetch()` stays comparable to
 * the real Worker's and the parity tests never see them.
 *
 * CORS (plan R4). `allowedOrigins` (default: none). An OPTIONS preflight on an
 * /mcp path from an allowed Origin answers 204 with
 * Access-Control-Allow-Origin: <that origin>, -Allow-Methods: POST, OPTIONS,
 * -Allow-Headers: content-type, authorization and Vary: Origin; every other
 * response to an allowed Origin carries Access-Control-Allow-Origin too. A
 * disallowed or absent Origin gets no Access-Control-* header at all. The real
 * Worker has no CORS yet — parity with it is pending #2146.
 *
 * KNOWN_DIFFERENCES — where the fake keeps the SHAPE but not the full
 * behaviour of the real handlers:
 *   1. Markdown → TipTap is simplified: each non-empty line becomes one
 *      paragraph with its leading markers (#, >, -, 1., - [ ]) and the
 *      ** / __ / ` marks stripped. `content` (TipTap JSON) therefore differs
 *      from the real one for anything but plain lines, and `contentText` can
 *      differ where the real converter splits a line into marked text nodes
 *      (it joins them with a space).
 *   2. No password-locked notes: nothing in the gateway can set a password,
 *      so `locked` / `lockedReason` and the "is password-protected" refusal
 *      are never produced.
 *   3. No routines: every event is a one-off, so delete_schedule_item's scope
 *      rule for an occurrence of a repeating event is unreachable (scope is
 *      accepted and ignored, as the real handler does for a one-off).
 *   4. No dailies: search_all's `dailies` domain is always empty, and
 *      search_by_tag never returns a daily.
 *   5. Timestamps are JavaScript ISO strings ("...T00:00:00.000Z"), not
 *      Postgres' ("...T00:00:00.123456+00:00"); timestamptz inputs
 *      (scheduled_at, scheduled_end_at, date_range) are stored as given
 *      instead of being re-spelled by Postgres. A value Date.parse cannot read
 *      is refused with Postgres' wording, but Postgres and Date.parse do not
 *      accept exactly the same set.
 *   6. No foreign keys: create_todo accepts a parent_id that does not exist
 *      (the database would refuse it).
 *   7. update_note never meets a concurrent writer, so the version conflict
 *      comes only from an expected_updated_at that is not the stored one.
 *   8. Ordering ties the database leaves unspecified (e.g. two events with
 *      the same start_time) fall back to insertion order.
 *   9. search_all matches todo content against the stored TipTap JSON text,
 *      as the real ILIKE does — so with difference 1, which todos match a
 *      word that only appears in markup can differ.
 */

import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/* ---- the spec ------------------------------------------------------------ */

const HERE = dirname(fileURLToPath(import.meta.url));

function findSpecPath() {
  const candidates = [
    process.env.EXTENSION_GATEWAY_SPEC,
    resolve(HERE, "extension-gateway.json"),
    resolve(HERE, "../spec/extension-gateway.json"),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(
    "extension-gateway-fake: spec not found. Put extension-gateway.json next " +
      "to this file or set EXTENSION_GATEWAY_SPEC. Looked at: " +
      candidates.join(", "),
  );
}

function loadSpec(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export const DEFAULT_SPEC_PATH = findSpecPath();
const DEFAULT_SPEC = loadSpec(DEFAULT_SPEC_PATH);

/** The gateway version of the spec this module loaded. */
export const GATEWAY_VERSION = DEFAULT_SPEC.gatewayVersion;
/** The life-editor commit that spec was generated from. */
export const LIFE_EDITOR_COMMIT = DEFAULT_SPEC.lifeEditorCommit;

/*
 * The MCP SDK's constants (@modelcontextprotocol/sdk types.js), copied because
 * this file may not import the SDK. The parity test runs `initialize` against
 * the real Worker with every one of them, so an SDK upgrade that moves them
 * fails there.
 */
const LATEST_PROTOCOL_VERSION = "2025-11-25";
const SUPPORTED_PROTOCOL_VERSIONS = [
  LATEST_PROTOCOL_VERSION,
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
  "2024-10-07",
];

/* ---- argument validation (mirror of src/utils/toolSchema.ts) ------------- */

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describeType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function checkValue(schema, value, path, problems) {
  switch (schema.type) {
    case "string":
      if (typeof value !== "string") {
        problems.push(`${path} must be a string (got ${describeType(value)})`);
        return;
      }
      if (schema.enum && !schema.enum.includes(value)) {
        problems.push(
          `${path} must be one of ${schema.enum.join(" | ")} (got ${JSON.stringify(value)})`,
        );
      }
      return;
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) {
        problems.push(`${path} must be a number (got ${describeType(value)})`);
      }
      return;
    case "boolean":
      if (typeof value !== "boolean") {
        problems.push(`${path} must be a boolean (got ${describeType(value)})`);
      }
      return;
    case "array": {
      if (!Array.isArray(value)) {
        problems.push(`${path} must be an array (got ${describeType(value)})`);
        return;
      }
      if (!schema.items) return;
      value.forEach((element, i) =>
        checkValue(schema.items, element, `${path}[${i}]`, problems),
      );
      return;
    }
    case "object":
      checkObject(schema, value, path, problems);
      return;
  }
}

function checkObject(schema, value, path, problems) {
  if (!isPlainObject(value)) {
    problems.push(`${path} must be an object (got ${describeType(value)})`);
    return;
  }
  for (const name of schema.required ?? []) {
    if (value[name] === undefined || value[name] === null) {
      problems.push(`${path ? `${path}.` : ""}${name} is required`);
    }
  }
  for (const [name, propertySchema] of Object.entries(
    schema.properties ?? {},
  )) {
    const supplied = value[name];
    if (supplied === undefined || supplied === null) continue;
    checkValue(
      propertySchema,
      supplied,
      path ? `${path}.${name}` : name,
      problems,
    );
  }
}

function validateToolArgs(toolName, schema, args) {
  const problems = [];
  checkObject(schema, args, "", problems);
  if (problems.length > 0) {
    throw new Error(
      `Invalid arguments for ${toolName}: ${problems.join("; ")}`,
    );
  }
}

function unknownArgNames(schema, args) {
  if (!isPlainObject(args)) return [];
  const declared = new Set(Object.keys(schema.properties ?? {}));
  return Object.keys(args).filter(
    (name) => !name.startsWith("_") && !declared.has(name),
  );
}

/** The first conditionalRequired rule `args` breaks, read from the spec. */
function brokenConditionalRule(toolSpec, args) {
  for (const rule of toolSpec.conditionalRequired ?? []) {
    if (args[rule.unless.field] === rule.unless.equals) continue;
    if (
      rule.require.some(
        (name) => args[name] === undefined || args[name] === null,
      )
    ) {
      return rule.message;
    }
  }
  return null;
}

/* ---- small helpers mirrored from src/utils -------------------------------- */

const DEFAULT_LIST_LIMIT = 50;
const DEFAULT_SEARCH_LIMIT = 10;
const PREVIEW_LENGTH = 100;
const DEFAULT_TAG_COLOR = "#808080";

function resolveListLimit(limit, fallback = DEFAULT_LIST_LIMIT) {
  if (limit === undefined || limit === null) return fallback;
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error(`limit must be a positive integer (got ${limit})`);
  }
  return limit;
}

function resolveListOffset(offset) {
  if (offset === undefined || offset === null) return 0;
  if (!Number.isInteger(offset) || offset < 0) {
    throw new Error(`offset must be a non-negative integer (got ${offset})`);
  }
  return offset;
}

function assertDateKey(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid date "${date}" (expected YYYY-MM-DD)`);
  }
  return date;
}

function assertTimeOfDay(value, field) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new Error(
      `Invalid ${field} "${value}" (expected HH:MM, 00:00-23:59)`,
    );
  }
  return value;
}

/** Postgres refuses a timestamptz it cannot parse; this is that refusal. */
function assertTimestamp(value, label) {
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(
      `${label}: invalid input syntax for type timestamp with time zone: "${value}"`,
    );
  }
}

const STATUS_TO_DB = { not_started: "NOT_STARTED", done: "DONE" };

function toDbStatus(status) {
  const mapped = STATUS_TO_DB[status.toLowerCase()];
  if (!mapped) {
    throw new Error(`Invalid status "${status}" (expected not_started|done)`);
  }
  return mapped;
}

function toToolStatus(status) {
  if (status === null) return null;
  if (status === "IN_PROGRESS") return "not_started";
  return status.toLowerCase();
}

function extractTextFromTipTap(node) {
  if (!node || typeof node !== "object") return "";
  if (node.type === "text" && typeof node.text === "string") return node.text;
  if (Array.isArray(node.content)) {
    return node.content.map(extractTextFromTipTap).join(" ");
  }
  return "";
}

function contentJsonToString(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function contentPlainText(value) {
  const s = contentJsonToString(value);
  if (s === "") return "";
  try {
    return extractTextFromTipTap(JSON.parse(s)).trim();
  } catch {
    return s;
  }
}

function contentPreview(value) {
  return contentPlainText(value).slice(0, PREVIEW_LENGTH);
}

/** KNOWN_DIFFERENCES 1: a one-paragraph-per-line stand-in for markdownToTiptap. */
function markdownToDoc(markdown) {
  const content = [];
  for (const raw of markdown.split(/\r?\n/)) {
    let line = raw.trim();
    if (line === "" || line.startsWith("```")) continue;
    line = line
      .replace(/^#{1,6}\s+/, "")
      .replace(/^>\s?(\[![A-Za-z]+\]\s*)?/, "")
      .replace(/^[-*+]\s+(\[[ xX]\]\s+)?/, "")
      .replace(/^\d+\.\s+/, "")
      .replace(/\*\*|__|`/g, "")
      .trim();
    if (line === "") continue;
    content.push({
      type: "paragraph",
      content: [{ type: "text", text: line }],
    });
  }
  return { type: "doc", content };
}

/** Same rule as noteHandlers.sameInstant: two spellings of one instant. */
function stampMicros(stamp) {
  const match = /\.(\d+)/.exec(stamp);
  const digits = (match?.[1] ?? "").padEnd(6, "0").slice(0, 6);
  const millis = Date.parse(
    match ? stamp.replace(/\.(\d+)/, `.${digits.slice(0, 3)}`) : stamp,
  );
  return Number.isNaN(millis) ? null : millis * 1000 + Number(digits.slice(3));
}

function sameInstant(a, b) {
  if (a === b) return true;
  const ma = stampMicros(a);
  return ma !== null && ma === stampMicros(b);
}

/** SQL LIKE (ILIKE) → anchored case-insensitive RegExp, backslash escapes kept. */
function likeToRegExp(pattern) {
  const quote = (c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let out = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "\\" && i + 1 < pattern.length) out += quote(pattern[++i]);
    else if (c === "%") out += ".*";
    else if (c === "_") out += ".";
    else out += quote(c);
  }
  return new RegExp(`^${out}$`, "is");
}

/* ---- dates in a zone (mirror of src/utils/localDate.ts) ------------------ */

function makeClock(timeZone) {
  const zoneOffsetMs = (instant) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(instant);
    const at = (type) =>
      Number(parts.find((p) => p.type === type)?.value ?? "0");
    const wallClockAsUtc = Date.UTC(
      at("year"),
      at("month") - 1,
      at("day"),
      at("hour"),
      at("minute"),
      at("second"),
    );
    return wallClockAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
  };
  const zonedMidnight = (date) => {
    const naive = Date.parse(`${date}T00:00:00Z`);
    const first = zoneOffsetMs(new Date(naive));
    const candidate = naive - first;
    const second = zoneOffsetMs(new Date(candidate));
    return new Date(second === first ? candidate : naive - second);
  };
  const addDays = (date, n) => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  return {
    today() {
      const now = new Date();
      return timeZone
        ? new Intl.DateTimeFormat("sv-SE", {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(now)
        : now.toLocaleDateString("sv-SE");
    },
    dayRange(date) {
      if (timeZone) {
        return {
          startIso: zonedMidnight(date).toISOString(),
          endIso: zonedMidnight(addDays(date, 1)).toISOString(),
        };
      }
      const start = new Date(`${date}T00:00:00`);
      const end = new Date(`${date}T00:00:00`);
      end.setDate(end.getDate() + 1);
      return { startIso: start.toISOString(), endIso: end.toISOString() };
    },
  };
}

/* ---- the in-memory store ------------------------------------------------- */

/*
 * Shaped like the tables the real handlers read (items_meta + one payload
 * table per role, wiki_tags, wiki_tag_assignments), so each tool below can be
 * a line-by-line reading of its handler.
 */
function createStore() {
  return {
    metas: new Map(),
    tasks: new Map(),
    notes: new Map(),
    events: new Map(),
    tags: new Map(),
    assignments: new Map(),
  };
}

const now = () => new Date().toISOString();
const byKey =
  (...keys) =>
  (a, b) => {
    for (const [key, dir] of keys) {
      const x = a[key];
      const y = b[key];
      if (x === y) continue;
      if (x === null || x === undefined) return dir === "asc" ? -1 : 1;
      if (y === null || y === undefined) return dir === "asc" ? 1 : -1;
      const diff = String(x) < String(y) ? -1 : 1;
      return dir === "asc" ? diff : -diff;
    }
    return 0;
  };

function createTools(state, clock) {
  const db = () => state.store;

  /* items_meta rituals (src/utils/items.ts) */
  const findMeta = (id, role) => {
    const meta = db().metas.get(id);
    return meta && meta.role === role && !meta.is_deleted ? meta : null;
  };
  const requireMeta = (id, role, label) => {
    const meta = findMeta(id, role);
    if (!meta) throw new Error(`${label} not found: ${id}`);
    return meta;
  };
  const insertItem = (id, role, title, table, payload) => {
    const at = now();
    db().metas.set(id, {
      id,
      role,
      title,
      is_deleted: false,
      deleted_at: null,
      created_at: at,
      updated_at: at,
    });
    db()[table].set(id, { item_id: id, ...payload });
  };
  const bumpMeta = (id, patch = {}) => {
    const meta = db().metas.get(id);
    if (meta) Object.assign(meta, patch, { updated_at: now() });
  };
  const updatePayload = (table, id, payloadPatch, metaPatch = {}) => {
    if (
      Object.keys(payloadPatch).length === 0 &&
      Object.keys(metaPatch).length === 0
    ) {
      return;
    }
    const row = db()[table].get(id);
    if (row && Object.keys(payloadPatch).length > 0)
      Object.assign(row, payloadPatch);
    bumpMeta(id, metaPatch);
  };
  const softDeleteItem = (id) => {
    const meta = db().metas.get(id);
    if (!meta) return;
    const at = now();
    Object.assign(meta, { is_deleted: true, deleted_at: at, updated_at: at });
  };

  /* wiki tags (src/handlers/wikiTagHandlers.ts) */
  const formatTag = (tag) => ({
    id: tag.id,
    name: tag.name,
    color: tag.color,
    icon: tag.icon ?? undefined,
    createdAt: tag.created_at,
    updatedAt: tag.updated_at,
  });
  const liveTags = () => [...db().tags.values()].filter((t) => !t.is_deleted);
  const findTagByName = (name) =>
    liveTags().find((t) => t.name === name) ?? null;
  const liveAssignments = () =>
    [...db().assignments.values()].filter((a) => !a.is_deleted);
  const getTagsForEntity = (itemId) => {
    const out = [];
    for (const a of liveAssignments()
      .filter((x) => x.item_id === itemId)
      .sort(byKey(["updated_at", "asc"], ["id", "asc"]))) {
      const tag = db().tags.get(a.tag_id);
      if (!tag || tag.is_deleted) continue;
      out.push({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        icon: tag.icon ?? undefined,
        assignedAt: a.updated_at,
      });
    }
    return out;
  };

  /* todos (src/handlers/todoHandlers.ts) */
  const formatTodoBase = (meta, p) => ({
    id: meta.id,
    type: p.task_type ?? "task",
    title: meta.title,
    parentId: p.parent_item_id,
    order: p.sort_order,
    status: toToolStatus(p.status),
    createdAt: meta.created_at,
    completedAt: p.completed_at,
    scheduledAt: p.scheduled_at,
    scheduledEndAt: p.scheduled_end_at,
    isAllDay: p.is_all_day,
    timeMemo: p.time_memo,
  });
  const formatTodo = (meta, p) => ({
    ...formatTodoBase(meta, p),
    content: p.content,
    contentText: contentPlainText(p.content),
  });
  const getTodoRows = (id) => {
    const meta = requireMeta(id, "task", "Todo");
    const payload = db().tasks.get(id);
    if (!payload) throw new Error(`Todo not found: ${id}`);
    return { meta, payload };
  };
  const rangeBound = (value, edge) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const { startIso, endIso } = clock.dayRange(value);
    return edge === "start" ? startIso : endIso;
  };

  /* notes (src/handlers/noteHandlers.ts) — never locked, see KNOWN_DIFFERENCES 2 */
  const formatNoteBase = (meta, p) => ({
    id: meta.id,
    type: "note",
    title: meta.title,
    isPinned: p.is_pinned,
    color: p.color ?? undefined,
    hasPassword: p.has_password,
    createdAt: meta.created_at,
    updatedAt: meta.updated_at,
  });
  const formatNote = (meta, p) => ({
    ...formatNoteBase(meta, p),
    content: contentJsonToString(p.content_json),
    contentText: contentPlainText(p.content_json),
  });
  const liveNotes = () =>
    [...db().metas.values()]
      .filter((m) => m.role === "note" && !m.is_deleted)
      .sort(byKey(["updated_at", "desc"], ["id", "asc"]))
      .flatMap((meta) => {
        const payload = db().notes.get(meta.id);
        return payload ? [{ meta, payload }] : [];
      });
  const getNoteRows = (id) => {
    const meta = requireMeta(id, "note", "Note");
    const payload = db().notes.get(id);
    if (!payload) throw new Error(`Note not found: ${id}`);
    return { meta, payload };
  };

  /* events (src/handlers/scheduleHandlers.ts) */
  const formatItem = (meta, p) => ({
    id: meta.id,
    date: p.start_at,
    title: meta.title,
    startTime: p.start_time,
    endTime: p.end_time,
    completed: p.done,
    completedAt: p.completed_at,
    routineId: p.routine_item_id,
    memo: p.memo,
    isDismissed: p.is_dismissed,
    isAllDay: p.is_all_day,
    isDeleted: meta.is_deleted,
    deletedAt: meta.deleted_at,
    createdAt: meta.created_at,
    updatedAt: meta.updated_at,
  });
  // Like the real getEvent: role is checked, is_deleted is NOT.
  const getEvent = (id) => {
    const meta = db().metas.get(id);
    const payload = db().events.get(id);
    if (!meta || meta.role !== "event" || !payload) {
      throw new Error(`Schedule item not found: ${id}`);
    }
    return { meta, payload };
  };
  const fetchEvents = (keep) => {
    const out = [];
    const rows = [...db().events.values()].filter(keep).sort((a, b) => {
      if (a.start_time === b.start_time) return 0;
      if (a.start_time === null) return 1; // nullsFirst: false
      if (b.start_time === null) return -1;
      return a.start_time < b.start_time ? -1 : 1;
    });
    for (const p of rows) {
      const meta = findMeta(p.item_id, "event");
      if (meta) out.push(formatItem(meta, p));
    }
    return out;
  };
  const fetchScheduledTodos = (startDate, endDate) => {
    const start = Date.parse(clock.dayRange(startDate).startIso);
    const end = Date.parse(clock.dayRange(endDate).endIso);
    return [...db().tasks.values()]
      .filter((t) => t.scheduled_at !== null)
      .filter((t) => {
        const at = Date.parse(t.scheduled_at);
        return at >= start && at < end;
      })
      .sort((a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at))
      .filter((t) => findMeta(t.item_id, "task"))
      .map((t) => ({
        id: t.item_id,
        title: db().metas.get(t.item_id).title,
        scheduledAt: t.scheduled_at,
        scheduledEndAt: t.scheduled_end_at,
        isAllDay: t.is_all_day,
        // The real handler hands back the DB's UPPERCASE status here.
        status: t.status,
      }));
  };

  const page = (matches, offset, limit) => ({
    results: matches.slice(offset, offset + limit),
    total: matches.length,
    hasMore: offset + limit < matches.length,
  });

  return {
    /* ---- todos ---- */
    list_todos(args) {
      const limit = resolveListLimit(args.limit);
      let payloads = [...db().tasks.values()];
      if (args.status) {
        const status = toDbStatus(args.status);
        payloads = payloads.filter((p) => p.status === status);
      }
      if (args.date_range) {
        const start = rangeBound(args.date_range.start, "start");
        const end = rangeBound(args.date_range.end, "end");
        assertTimestamp(start, "list tasks_payload");
        assertTimestamp(end, "list tasks_payload");
        payloads = payloads.filter(
          (p) =>
            p.scheduled_at !== null &&
            Date.parse(p.scheduled_at) >= Date.parse(start) &&
            Date.parse(p.scheduled_at) < Date.parse(end),
        );
      }
      if (args.parent_id) {
        payloads = payloads.filter((p) => p.parent_item_id === args.parent_id);
      }
      payloads.sort(byKey(["sort_order", "asc"], ["item_id", "asc"]));
      const live = payloads.filter(
        (p) => p.task_type !== "folder" && findMeta(p.item_id, "task"),
      );
      const todos = live.slice(0, limit).map((p) => {
        const meta = findMeta(p.item_id, "task");
        const base = {
          ...formatTodoBase(meta, p),
          contentPreview: contentPreview(p.content),
        };
        return args.include_content === true
          ? {
              ...base,
              content: p.content,
              contentText: contentPlainText(p.content),
            }
          : base;
      });
      return { todos, total: live.length, hasMore: live.length > todos.length };
    },

    get_todo(args) {
      const { meta, payload } = getTodoRows(args.id);
      return { ...formatTodo(meta, payload), tags: getTagsForEntity(args.id) };
    },

    create_todo(args) {
      const status =
        args.status === undefined ? "NOT_STARTED" : toDbStatus(args.status);
      if (args.scheduled_at !== undefined)
        assertTimestamp(args.scheduled_at, "create tasks_payload");
      if (args.scheduled_end_at !== undefined) {
        assertTimestamp(args.scheduled_end_at, "create tasks_payload");
      }
      const id = `task-${randomUUID()}`;
      const parent = args.parent_id ?? null;
      const siblings = [...db().tasks.values()].filter(
        (p) => p.parent_item_id === parent,
      );
      const maxOrder = siblings.reduce(
        (max, p) => Math.max(max, p.sort_order),
        -1,
      );
      insertItem(id, "task", args.title, "tasks", {
        parent_item_id: parent,
        task_type: "task",
        status,
        completed_at: status === "DONE" ? now() : null,
        content: args.content
          ? JSON.stringify(markdownToDoc(args.content))
          : null,
        time_memo: null,
        scheduled_at: args.scheduled_at ?? null,
        scheduled_end_at: args.scheduled_end_at ?? null,
        is_all_day: args.is_all_day ?? false,
        sort_order: maxOrder + 1,
      });
      const { meta, payload } = getTodoRows(id);
      return formatTodo(meta, payload);
    },

    update_todo(args) {
      getTodoRows(args.id);
      const metaPatch = {};
      if (args.title !== undefined) metaPatch.title = args.title;
      const payloadPatch = {};
      if (args.status !== undefined) {
        const dbStatus = toDbStatus(args.status);
        payloadPatch.status = dbStatus;
        payloadPatch.completed_at = dbStatus === "DONE" ? now() : null;
      }
      if (args.scheduled_at !== undefined) {
        assertTimestamp(args.scheduled_at, "update tasks_payload");
        payloadPatch.scheduled_at = args.scheduled_at;
      }
      if (args.scheduled_end_at !== undefined) {
        assertTimestamp(args.scheduled_end_at, "update tasks_payload");
        payloadPatch.scheduled_end_at = args.scheduled_end_at;
      }
      if (args.content !== undefined) {
        payloadPatch.content = JSON.stringify(markdownToDoc(args.content));
      }
      if (args.time_memo !== undefined) payloadPatch.time_memo = args.time_memo;
      updatePayload("tasks", args.id, payloadPatch, metaPatch);
      const { meta, payload } = getTodoRows(args.id);
      return formatTodo(meta, payload);
    },

    delete_todo(args) {
      requireMeta(args.id, "task", "Todo");
      softDeleteItem(args.id);
      return { success: true, id: args.id, softDeleted: true };
    },

    /* ---- notes ---- */
    list_notes(args) {
      const limit = resolveListLimit(args.limit);
      const needle = args.query?.toLowerCase();
      const matched = liveNotes().filter(({ meta, payload }) => {
        if (!needle) return true;
        const body = payload.has_password
          ? ""
          : contentPlainText(payload.content_json);
        return `${meta.title}\n${body}`.toLowerCase().includes(needle);
      });
      const notes = matched.slice(0, limit).map(({ meta, payload }) => {
        const base = {
          ...formatNoteBase(meta, payload),
          contentPreview: contentPreview(payload.content_json),
        };
        return args.include_content === true
          ? {
              ...base,
              content: contentJsonToString(payload.content_json),
              contentText: contentPlainText(payload.content_json),
            }
          : base;
      });
      return {
        notes,
        total: matched.length,
        hasMore: matched.length > notes.length,
      };
    },

    get_note(args) {
      const { meta, payload } = getNoteRows(args.id);
      return formatNote(meta, payload);
    },

    create_note(args) {
      const id = `note-${randomUUID()}`;
      insertItem(id, "note", args.title, "notes", {
        note_type: "note",
        content_json: args.content ? markdownToDoc(args.content) : null,
        is_pinned: false,
        color: null,
        has_password: false,
      });
      const { meta, payload } = getNoteRows(id);
      return formatNote(meta, payload);
    },

    update_note(args) {
      const before = getNoteRows(args.id);
      if (
        args.expected_updated_at !== undefined &&
        !sameInstant(args.expected_updated_at, before.meta.updated_at)
      ) {
        throw new Error(
          `Note ${args.id} was changed after you read it ` +
            `(expected updated_at ${args.expected_updated_at}, now ${before.meta.updated_at}). ` +
            "Nothing was written. Call get_note to read the latest version, merge " +
            "your change into it, then call update_note again with " +
            "expected_updated_at set to the updatedAt get_note returned.",
        );
      }
      const metaPatch = {};
      if (args.title !== undefined) metaPatch.title = args.title;
      if (args.content !== undefined) {
        // The real body write moves updated_at and the title together.
        before.payload.content_json = markdownToDoc(args.content);
        bumpMeta(args.id, metaPatch);
        delete metaPatch.title;
      }
      const payloadPatch = {};
      if (args.color !== undefined) payloadPatch.color = args.color;
      if (args.is_pinned !== undefined) payloadPatch.is_pinned = args.is_pinned;
      updatePayload("notes", args.id, payloadPatch, metaPatch);
      const { meta, payload } = getNoteRows(args.id);
      return formatNote(meta, payload);
    },

    delete_note(args) {
      requireMeta(args.id, "note", "Note");
      softDeleteItem(args.id);
      return { success: true, id: args.id, softDeleted: true };
    },

    /* ---- schedule ---- */
    list_schedule(args) {
      if (Boolean(args.start_date) !== Boolean(args.end_date)) {
        const given = args.start_date ? "start_date" : "end_date";
        const missing = args.start_date ? "end_date" : "start_date";
        throw new Error(
          `${missing} is required when ${given} is given (use date on its own for a single day)`,
        );
      }
      if (args.date && args.start_date) {
        throw new Error(
          "date and start_date/end_date are mutually exclusive (pass a single day or a range, not both)",
        );
      }
      if (args.start_date && args.end_date) {
        assertDateKey(args.start_date);
        assertDateKey(args.end_date);
        return {
          scheduleItems: fetchEvents(
            (p) =>
              p.start_at !== null &&
              p.start_at >= args.start_date &&
              p.start_at <= args.end_date &&
              !p.is_dismissed,
          ),
          scheduledTodos: fetchScheduledTodos(args.start_date, args.end_date),
        };
      }
      const date = assertDateKey(args.date ?? clock.today());
      return {
        scheduleItems: fetchEvents(
          (p) => p.start_at === date && !p.is_dismissed,
        ),
        scheduledTodos: fetchScheduledTodos(date, date),
      };
    },

    create_schedule_item(args, ctx) {
      assertDateKey(args.date);
      ctx.applyConditionalRules();
      if (!args.is_all_day) {
        // The handler treats "" as missing too, which the spec's rule does not say.
        if (!args.start_time || !args.end_time) {
          throw new Error(
            "start_time and end_time are required unless is_all_day is true",
          );
        }
        assertTimeOfDay(args.start_time, "start_time");
        assertTimeOfDay(args.end_time, "end_time");
      }
      const id = `si-${randomUUID()}`;
      insertItem(id, "event", args.title, "events", {
        start_at: args.date,
        start_time: args.is_all_day ? null : args.start_time,
        end_time: args.is_all_day ? null : args.end_time,
        is_all_day: args.is_all_day ?? false,
        done: false,
        completed_at: null,
        is_dismissed: false,
        memo: args.memo ?? null,
        routine_item_id: null,
      });
      const { meta, payload } = getEvent(id);
      return formatItem(meta, payload);
    },

    update_schedule_item(args) {
      if (args.date !== undefined) assertDateKey(args.date);
      if (args.start_time !== undefined)
        assertTimeOfDay(args.start_time, "start_time");
      if (args.end_time !== undefined)
        assertTimeOfDay(args.end_time, "end_time");
      const { payload: current } = getEvent(args.id);
      const metaPatch = {};
      if (args.title !== undefined) metaPatch.title = args.title;
      const payloadPatch = {};
      if (args.date !== undefined) payloadPatch.start_at = args.date;
      if (args.start_time !== undefined)
        payloadPatch.start_time = args.start_time;
      if (args.end_time !== undefined) payloadPatch.end_time = args.end_time;
      if (args.memo !== undefined) payloadPatch.memo = args.memo;
      if (args.is_all_day !== undefined) {
        payloadPatch.is_all_day = args.is_all_day;
        if (args.is_all_day) {
          payloadPatch.start_time = null;
          payloadPatch.end_time = null;
        } else {
          const start = args.start_time ?? current.start_time;
          const end = args.end_time ?? current.end_time;
          if (!start || !end) {
            throw new Error(
              "start_time and end_time are required when turning is_all_day off (this item has none stored)",
            );
          }
          payloadPatch.start_time = start;
          payloadPatch.end_time = end;
        }
      }
      if (Object.keys(payloadPatch).length > 0) {
        updatePayload("events", args.id, payloadPatch, metaPatch);
      } else {
        bumpMeta(args.id, metaPatch);
      }
      const { meta, payload } = getEvent(args.id);
      return formatItem(meta, payload);
    },

    delete_schedule_item(args) {
      // KNOWN_DIFFERENCES 3: no routines, so every event is a one-off.
      getEvent(args.id);
      softDeleteItem(args.id);
      return { success: true, id: args.id, softDeleted: true };
    },

    set_schedule_complete(args) {
      getEvent(args.id);
      updatePayload("events", args.id, {
        done: args.completed,
        completed_at: args.completed ? now() : null,
      });
      const { meta, payload } = getEvent(args.id);
      return formatItem(meta, payload);
    },

    set_schedule_dismissed(args) {
      getEvent(args.id);
      updatePayload("events", args.id, { is_dismissed: args.dismissed });
      const { meta, payload } = getEvent(args.id);
      return formatItem(meta, payload);
    },

    /* ---- wiki tags ---- */
    list_wiki_tags(args) {
      let tags = liveTags();
      if (args.query) {
        const re = likeToRegExp(`%${args.query}%`);
        tags = tags.filter((t) => re.test(t.name));
      }
      tags.sort(byKey(["name", "asc"], ["id", "asc"]));
      const counts = new Map();
      for (const a of liveAssignments()) {
        counts.set(a.tag_id, (counts.get(a.tag_id) ?? 0) + 1);
      }
      return tags.map((tag) => ({
        ...formatTag(tag),
        usageCount: counts.get(tag.id) ?? 0,
      }));
    },

    get_entity_tags(args) {
      return {
        entityId: args.entity_id,
        tags: getTagsForEntity(args.entity_id),
      };
    },

    search_by_tag(args) {
      const tag = findTagByName(args.tag_name);
      if (!tag) return { tag: null, results: [] };
      const assignments = liveAssignments()
        .filter((a) => a.tag_id === tag.id)
        .sort(byKey(["id", "asc"]));
      const results = [];
      for (const a of assignments) {
        const meta = db().metas.get(a.item_id);
        if (!meta || meta.is_deleted) continue;
        if (args.entity_type && meta.role !== args.entity_type) continue;
        const todo = meta.role === "task" ? db().tasks.get(meta.id) : undefined;
        results.push({
          entityId: meta.id,
          entityType: meta.role,
          assignedAt: a.updated_at,
          entity: {
            id: meta.id,
            title: meta.title,
            createdAt: meta.created_at,
            ...(todo
              ? {
                  status:
                    todo.status === null ? null : todo.status.toLowerCase(),
                  scheduledAt: todo.scheduled_at,
                }
              : {}),
          },
        });
      }
      return { tag: formatTag(tag), results };
    },

    tag_entity(args) {
      const meta = db().metas.get(args.entity_id);
      if (!meta || meta.is_deleted)
        throw new Error(`Item not found: ${args.entity_id}`);
      if (args.entity_type && args.entity_type !== meta.role) {
        throw new Error(
          `Item ${args.entity_id} is a "${meta.role}", not a "${args.entity_type}"`,
        );
      }
      const at = now();
      let tag = findTagByName(args.tag_name);
      if (!tag) {
        tag = {
          id: `tag-${randomUUID()}`,
          name: args.tag_name,
          color: DEFAULT_TAG_COLOR,
          icon: null,
          is_deleted: false,
          created_at: at,
          updated_at: at,
        };
        db().tags.set(tag.id, tag);
      }
      const existing = [...db().assignments.values()]
        .filter((a) => a.item_id === args.entity_id && a.tag_id === tag.id)
        .sort(
          (a, b) =>
            Number(a.is_deleted) - Number(b.is_deleted) ||
            byKey(["created_at", "asc"])(a, b),
        )[0];
      if (existing) {
        if (existing.is_deleted) {
          Object.assign(existing, {
            is_deleted: false,
            deleted_at: null,
            updated_at: at,
          });
        }
      } else {
        const id = `tag_assign-${randomUUID()}`;
        db().assignments.set(id, {
          id,
          item_id: args.entity_id,
          tag_id: tag.id,
          is_deleted: false,
          deleted_at: null,
          created_at: at,
          updated_at: at,
        });
      }
      return {
        tag: formatTag(tag),
        entityId: args.entity_id,
        entityType: meta.role,
      };
    },

    untag_entity(args) {
      const tag = findTagByName(args.tag_name);
      if (!tag) return { removed: false };
      const live = liveAssignments().find(
        (a) => a.item_id === args.entity_id && a.tag_id === tag.id,
      );
      if (!live) return { removed: false };
      const at = now();
      Object.assign(live, { is_deleted: true, deleted_at: at, updated_at: at });
      return { removed: true, tag: formatTag(tag), entityId: args.entity_id };
    },

    /* ---- search ---- */
    search_all(args) {
      const limit = resolveListLimit(args.limit, DEFAULT_SEARCH_LIMIT);
      const offset = resolveListOffset(args.offset);
      const valid = ["todos", "dailies", "notes"];
      const domains = args.domains
        ? args.domains.filter((d) => valid.includes(d))
        : valid;
      const needle = args.query.toLowerCase();
      const result = {};
      let totalHits = 0;

      if (domains.includes("todos")) {
        const matches = [...db().metas.values()]
          .filter((m) => m.role === "task" && !m.is_deleted)
          .flatMap((meta) => {
            const p = db().tasks.get(meta.id);
            if (!p || p.task_type === "folder") return [];
            const hit =
              meta.title.toLowerCase().includes(needle) ||
              (p.content ?? "").toLowerCase().includes(needle);
            return hit ? [{ meta, p }] : [];
          })
          .sort(
            (a, b) =>
              b.meta.created_at.localeCompare(a.meta.created_at) ||
              a.meta.id.localeCompare(b.meta.id),
          )
          .map(({ meta, p }) => ({
            id: meta.id,
            title: meta.title,
            status: p.status === null ? null : p.status.toLowerCase(),
            scheduledAt: p.scheduled_at,
            contentPreview: contentPreview(p.content),
          }));
        result.todos = page(matches, offset, limit);
        totalHits += result.todos.total;
      }
      if (domains.includes("dailies")) {
        // KNOWN_DIFFERENCES 4: the gateway has no daily tools, so none exist here.
        result.dailies = page([], offset, limit);
      }
      if (domains.includes("notes")) {
        const matches = liveNotes()
          .map(({ meta, payload }) => ({
            id: meta.id,
            title: meta.title,
            updatedAt: meta.updated_at,
            text: contentPlainText(payload.content_json),
          }))
          .filter(
            (n) =>
              n.title.toLowerCase().includes(needle) ||
              n.text.toLowerCase().includes(needle),
          )
          .map((n) => ({
            id: n.id,
            title: n.title,
            contentPreview: n.text.slice(0, PREVIEW_LENGTH),
            updatedAt: n.updatedAt,
          }));
        result.notes = page(matches, offset, limit);
        totalHits += result.notes.total;
      }
      return { ...result, totalHits };
    },
  };
}

/* ---- the gateway --------------------------------------------------------- */

const JSON_HEADERS = { "content-type": "application/json" };
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;

function rpcResult(id, result) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), {
    headers: JSON_HEADERS,
  });
}

function rpcError(id, code, message) {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: id ?? null,
      error: { code, message },
    }),
    { headers: JSON_HEADERS },
  );
}

function isMcpPath(pathname) {
  return pathname === "/mcp" || pathname.startsWith("/mcp/");
}

function notFound() {
  return new Response("Not found", { status: 404 });
}

function secretEquals(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function presentedTokens(url, request) {
  const tokens = [];
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer "))
    tokens.push(auth.slice("Bearer ".length).trim());
  const match = /^\/mcp\/(.+)$/.exec(url.pathname);
  if (match) {
    try {
      tokens.push(decodeURIComponent(match[1]));
    } catch {
      // The Worker would throw here (a 500 from the platform); a fake that
      // refuses is the closer thing a test can observe.
    }
  }
  return tokens;
}

/**
 * A fake gateway: `fetch` answers one HTTP request the way the real Worker
 * does; `calls` lists every tools/call received; `reset` forgets them and
 * empties the store.
 */
export function createFakeGateway(options = {}) {
  const { token, specPath, allowedOrigins = [], timeZone = null } = options;
  if (typeof token !== "string") {
    throw new Error("createFakeGateway: `token` (string) is required");
  }
  const spec = specPath ? loadSpec(specPath) : DEFAULT_SPEC;
  const toolSpecs = new Map(spec.tools.map((t) => [t.name, t]));
  const toolList = spec.tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));
  const allowed = new Set(allowedOrigins);
  const clock = makeClock(timeZone);

  const state = { store: createStore() };
  const tools = createTools(state, clock);
  for (const name of toolSpecs.keys()) {
    if (!tools[name]) {
      throw new Error(
        `extension-gateway-fake: no implementation for spec tool "${name}"`,
      );
    }
  }
  let recorded = [];

  async function callTool(name, args) {
    const toolSpec = toolSpecs.get(name);
    if (!toolSpec) throw new Error(`Unknown tool: ${name}`);
    validateToolArgs(name, toolSpec.inputSchema, args);
    const ignored = unknownArgNames(toolSpec.inputSchema, args);

    // The spec's conditional rules. A handler that takes `ctx` applies them
    // at the point the real handler checks them (after its own format
    // asserts, so a bad date still wins); for every other tool they run here,
    // before the handler.
    const ctx = {
      applyConditionalRules() {
        const message = brokenConditionalRule(toolSpec, args);
        if (message) throw new Error(message);
      },
    };
    const run = tools[name];
    if (run.length < 2) ctx.applyConditionalRules();
    const result = run(args, ctx);

    const content = [{ type: "text", text: JSON.stringify(result, null, 2) }];
    if (ignored.length > 0) {
      content.push({
        type: "text",
        text:
          `Note: ${name} does not accept ${ignored.join(", ")}. ` +
          `Nothing was applied for ${ignored.length === 1 ? "it" : "them"} — ` +
          `check this tool's schema for the argument you meant.`,
      });
    }
    return { content };
  }

  async function handleRpc(message) {
    const { id, method } = message;
    switch (method) {
      case "initialize": {
        const asked = message.params?.protocolVersion ?? "";
        const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(asked)
          ? asked
          : LATEST_PROTOCOL_VERSION;
        return rpcResult(id, {
          protocolVersion,
          capabilities: { tools: {} },
          serverInfo: { name: "life-editor", version: "1.0.0" },
        });
      }
      case "ping":
        return rpcResult(id, {});
      case "tools/list":
        return rpcResult(id, { tools: toolList });
      case "tools/call": {
        const name = message.params?.name;
        if (typeof name !== "string") {
          return rpcError(
            id,
            INVALID_REQUEST,
            "tools/call requires a tool name",
          );
        }
        const args = message.params?.arguments ?? {};
        try {
          const result = await callTool(name, args);
          recorded.push({
            tool: name,
            arguments: args,
            ok: true,
            error: null,
            timestamp: now(),
          });
          return rpcResult(id, result);
        } catch (error) {
          const text = error instanceof Error ? error.message : String(error);
          recorded.push({
            tool: name,
            arguments: args,
            ok: false,
            error: text,
            timestamp: now(),
          });
          return rpcResult(id, {
            content: [{ type: "text", text: `Error: ${text}` }],
            isError: true,
          });
        }
      }
      default:
        return rpcError(id, METHOD_NOT_FOUND, `Unknown method: ${method}`);
    }
  }

  async function serve(request, url) {
    if (request.method === "GET" && url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: JSON_HEADERS,
      });
    }

    const presented = presentedTokens(url, request);
    const authorized =
      token !== "" &&
      isMcpPath(url.pathname) &&
      presented.some((candidate) => secretEquals(candidate, token));
    if (!authorized) return notFound();

    if (request.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: { allow: "POST" },
      });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return rpcError(null, PARSE_ERROR, "Request body is not valid JSON");
    }
    if (Array.isArray(body)) {
      return rpcError(
        null,
        INVALID_REQUEST,
        "Batched requests are not supported — send one JSON-RPC message.",
      );
    }
    if (typeof body !== "object" || body === null) {
      return rpcError(null, INVALID_REQUEST, "Expected a JSON-RPC object");
    }
    if (typeof body.method !== "string") {
      return rpcError(null, INVALID_REQUEST, "Missing JSON-RPC method");
    }
    if (body.id === undefined || body.id === null) {
      return new Response(null, { status: 202 });
    }
    return handleRpc(body);
  }

  return {
    async fetch(request) {
      const url = new URL(request.url);
      const origin = request.headers.get("origin");
      const corsOrigin = origin !== null && allowed.has(origin) ? origin : null;

      // Preflight carries no credentials, so it is answered before the token
      // check — only for an allowed Origin, and only on the MCP path.
      if (
        request.method === "OPTIONS" &&
        corsOrigin &&
        isMcpPath(url.pathname)
      ) {
        return new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": corsOrigin,
            "access-control-allow-methods": "POST, OPTIONS",
            "access-control-allow-headers": "content-type, authorization",
            vary: "Origin",
          },
        });
      }

      const response = await serve(request, url);
      if (allowed.size > 0) response.headers.append("vary", "Origin");
      if (corsOrigin)
        response.headers.set("access-control-allow-origin", corsOrigin);
      return response;
    },
    calls() {
      return recorded.map((call) => ({ ...call }));
    },
    reset() {
      recorded = [];
      state.store = createStore();
    },
  };
}

/* ---- node:http ----------------------------------------------------------- */

const SKIPPED_REQUEST_HEADERS = new Set([
  "host",
  "connection",
  "content-length",
  "transfer-encoding",
  "keep-alive",
]);

/**
 * Serve `gateway` on `port` (0 = any free one) at 127.0.0.1. Adds the
 * test-double routes GET /__calls and POST /__reset (no token — see header).
 */
export function listen(gateway, port = 0, host = "127.0.0.1") {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? host}`);
      if (url.pathname === "/__calls" && req.method === "GET") {
        res.writeHead(200, JSON_HEADERS);
        res.end(JSON.stringify(gateway.calls()));
        return;
      }
      if (url.pathname === "/__reset" && req.method === "POST") {
        gateway.reset();
        res.writeHead(200, JSON_HEADERS);
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const headers = new Headers();
      for (let i = 0; i < req.rawHeaders.length; i += 2) {
        const name = req.rawHeaders[i];
        if (!SKIPPED_REQUEST_HEADERS.has(name.toLowerCase())) {
          headers.append(name, req.rawHeaders[i + 1]);
        }
      }
      const method = req.method ?? "GET";
      const request = new Request(url, {
        method,
        headers,
        body:
          method === "GET" || method === "HEAD"
            ? undefined
            : Buffer.concat(chunks),
      });
      const response = await gateway.fetch(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      res.writeHead(500, { "content-type": "text/plain" });
      res.end(error instanceof Error ? error.message : String(error));
    }
  });

  return new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      const address = server.address();
      const bound =
        typeof address === "object" && address ? address.port : port;
      resolvePromise({
        port: bound,
        url: `http://${host}:${bound}`,
        server,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

/* ---- command line -------------------------------------------------------- */

function parseArgv(argv) {
  const out = { origins: [] };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--port") ((out.port = Number(value)), i++);
    else if (flag === "--token") ((out.token = value), i++);
    else if (flag === "--origin") (out.origins.push(value), i++);
    else if (flag === "--spec") ((out.spec = value), i++);
    else if (flag === "--tz") ((out.tz = value), i++);
  }
  return out;
}

async function main() {
  const argv = parseArgv(process.argv.slice(2));
  const token = argv.token ?? process.env.FAKE_GATEWAY_TOKEN;
  if (!token) {
    console.error(
      "usage: node extension-gateway-fake.mjs --token <token> [--port 8787] " +
        "[--origin <allowed origin>]... [--spec <path>] [--tz <IANA zone>]",
    );
    process.exit(1);
  }
  const gateway = createFakeGateway({
    token,
    specPath: argv.spec,
    allowedOrigins: argv.origins,
    timeZone: argv.tz ?? null,
  });
  const { url } = await listen(gateway, argv.port ?? 8787);
  console.log(
    `extension-gateway-fake ${GATEWAY_VERSION} (life-editor ${LIFE_EDITOR_COMMIT}) ` +
      `listening on ${url}/mcp/<token> — GET /__calls, POST /__reset`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
